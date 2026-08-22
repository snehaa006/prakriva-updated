"""Tests for gemini_service.py's key rotation, multi-turn chat, and the
patient-chat prompt builder. All Gemini HTTP calls are mocked — no network."""
import os
import sys
from unittest.mock import Mock, patch

import pytest
import requests

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import gemini_service
from gemini_service import GeminiUnavailable


def with_keys(monkeypatch, *keys):
    monkeypatch.setattr(gemini_service.settings, "GEMINI_API_KEYS", list(keys))


@pytest.fixture(autouse=True)
def reset_key_pool_state(monkeypatch):
    """Every test starts with a clean pool and no keys configured.

    The model chain is reset too, and discovery is stubbed out so no test can
    reach the network by exhausting it.
    """
    with_keys(monkeypatch)
    gemini_service._cooldown_until.clear()
    gemini_service._active_key_index = 0
    gemini_service._retired_models.clear()
    gemini_service._resolved_model = None
    gemini_service._discovered_models = []
    yield
    gemini_service._cooldown_until.clear()
    gemini_service._active_key_index = 0
    gemini_service._retired_models.clear()
    gemini_service._resolved_model = None
    gemini_service._discovered_models = None


def model_gone_response() -> Mock:
    """What Gemini answers for a model ID that has been shut down."""
    response = Mock(status_code=404)
    response.json.return_value = {
        "error": {
            "status": "NOT_FOUND",
            "message": (
                "models/gemini-2.0-flash is not found for API version v1beta, "
                "or is not supported for generateContent."
            ),
        }
    }
    return response


def overloaded_response() -> Mock:
    """What Gemini answers when the model itself is out of capacity."""
    response = Mock(status_code=503)
    response.json.return_value = {
        "error": {
            "status": "UNAVAILABLE",
            "message": (
                "This model is currently experiencing high demand. Spikes in "
                "demand are usually temporary. Please try again later."
            ),
        }
    }
    return response


def candidates_response(text: str) -> Mock:
    response = Mock(status_code=200)
    response.json.return_value = {"candidates": [{"content": {"parts": [{"text": text}]}}]}
    return response


class TestIsConfigured:
    def test_false_with_no_keys(self):
        assert gemini_service.is_configured() is False

    def test_true_with_one_key(self, monkeypatch):
        with_keys(monkeypatch, "key-a")
        assert gemini_service.is_configured() is True


class TestKeyRotationOrdering:
    def test_no_keys_means_no_candidates(self):
        assert gemini_service._key_candidates() == []

    def test_starts_with_the_active_key(self, monkeypatch):
        with_keys(monkeypatch, "a", "b", "c")
        assert gemini_service._key_candidates() == ["a", "b", "c"]

    def test_a_failed_key_sorts_after_ready_ones(self, monkeypatch):
        with_keys(monkeypatch, "a", "b", "c")
        gemini_service._report_key_result("a", status=429, ok=False)
        assert gemini_service._key_candidates() == ["b", "c", "a"]

    def test_success_clears_cooldown_and_becomes_active(self, monkeypatch):
        with_keys(monkeypatch, "a", "b", "c")
        gemini_service._report_key_result("a", status=429, ok=False)
        gemini_service._report_key_result("b", status=200, ok=True)
        # "b" is active (tried first); "a" is still cooling down and sorts last.
        assert gemini_service._key_candidates() == ["b", "c", "a"]

    @pytest.mark.parametrize(
        "status,expected_seconds",
        [(429, 60.0), (401, 900.0), (403, 900.0), (400, 900.0), (500, 30.0), (None, 30.0)],
    )
    def test_cooldown_duration_by_failure_reason(self, status, expected_seconds):
        assert gemini_service._cooldown_seconds(status) == expected_seconds


class TestPostGemini:
    def test_raises_when_unconfigured(self):
        with pytest.raises(GeminiUnavailable, match="No GEMINI_API_KEY"):
            gemini_service._post_gemini({}, timeout=5)

    def test_succeeds_on_the_first_key(self, monkeypatch):
        with_keys(monkeypatch, "good-key")
        with patch("gemini_service.requests.post", return_value=candidates_response("hi")) as mock_post:
            body = gemini_service._post_gemini({"x": 1}, timeout=5)
        assert body["candidates"][0]["content"]["parts"][0]["text"] == "hi"
        assert mock_post.call_args.kwargs["params"] == {"key": "good-key"}

    def test_rotates_past_a_rate_limited_key(self, monkeypatch):
        with_keys(monkeypatch, "bad-key", "good-key")
        rate_limited = Mock(status_code=429)
        with patch(
            "gemini_service.requests.post",
            side_effect=[rate_limited, candidates_response("ok")],
        ) as mock_post:
            body = gemini_service._post_gemini({}, timeout=5)
        assert body["candidates"][0]["content"]["parts"][0]["text"] == "ok"
        assert mock_post.call_count == 2
        assert mock_post.call_args_list[0].kwargs["params"] == {"key": "bad-key"}
        assert mock_post.call_args_list[1].kwargs["params"] == {"key": "good-key"}

    def test_raises_once_every_key_has_failed(self, monkeypatch):
        with_keys(monkeypatch, "a", "b")
        with patch("gemini_service.requests.post", return_value=Mock(status_code=429)):
            with pytest.raises(GeminiUnavailable):
                gemini_service._post_gemini({}, timeout=5)

    def test_a_non_key_error_is_not_retried_on_other_keys(self, monkeypatch):
        """A 400 for a malformed request would fail identically on every key,
        so it is raised immediately rather than burning the rotation."""
        with_keys(monkeypatch, "a", "b")
        response = Mock(status_code=400)
        response.json.return_value = {"error": {"status": "INVALID_ARGUMENT", "message": "bad"}}
        with patch("gemini_service.requests.post", return_value=response) as mock_post:
            with pytest.raises(GeminiUnavailable, match="400"):
                gemini_service._post_gemini({}, timeout=5)
        assert mock_post.call_count == 1

    def test_a_malformed_request_400_does_not_burn_the_key_pool(self, monkeypatch):
        """Gemini answers both "bad key" and "bad request" with a 400.

        Treating the second as a key failure rotated through every key and
        parked each one for fifteen minutes, so one malformed request took the
        chatbot (and every other Gemini feature) down until the cooldowns
        expired.
        """
        with_keys(monkeypatch, "a", "b")
        response = Mock(status_code=400)
        response.json.return_value = {
            "error": {"status": "INVALID_ARGUMENT", "message": "Please ensure that contents are valid"}
        }
        with patch("gemini_service.requests.post", return_value=response) as mock_post:
            with pytest.raises(GeminiUnavailable, match="INVALID_ARGUMENT"):
                gemini_service._post_gemini({}, timeout=5)
        assert mock_post.call_count == 1
        assert gemini_service._cooldown_until == {}

    def test_a_400_about_the_key_still_rotates(self, monkeypatch):
        with_keys(monkeypatch, "a", "b")
        invalid_key = Mock(status_code=400)
        invalid_key.json.return_value = {
            "error": {"status": "INVALID_ARGUMENT", "message": "API key not valid. Please pass a valid API key."}
        }
        with patch(
            "gemini_service.requests.post",
            side_effect=[invalid_key, candidates_response("ok")],
        ) as mock_post:
            body = gemini_service._post_gemini({}, timeout=5)
        assert body["candidates"][0]["content"]["parts"][0]["text"] == "ok"
        assert mock_post.call_count == 2

    def test_the_failure_reason_reaches_the_caller_without_the_key(self, monkeypatch):
        with_keys(monkeypatch, "secret-key-value")
        response = Mock(status_code=400)
        response.json.return_value = {
            "error": {"status": "INVALID_ARGUMENT", "message": "bad request for key=secret-key-value"}
        }
        with patch("gemini_service.requests.post", return_value=response):
            with pytest.raises(GeminiUnavailable) as excinfo:
                gemini_service._post_gemini({}, timeout=5)
        assert "bad request" in str(excinfo.value)
        assert "secret-key-value" not in str(excinfo.value)

    def test_a_network_error_moves_to_the_next_key(self, monkeypatch):
        with_keys(monkeypatch, "a", "b")
        with patch(
            "gemini_service.requests.post",
            side_effect=[requests.ConnectionError("boom"), candidates_response("ok")],
        ):
            body = gemini_service._post_gemini({}, timeout=5)
        assert body["candidates"][0]["content"]["parts"][0]["text"] == "ok"


class TestModelFailover:
    """What happens when Google retires the model ID the app is calling.

    This is not hypothetical: gemini-2.0-flash — the default this app shipped
    with — was shut down on 1 June 2026, after which every Gemini call
    answered 404. The chatbot, which has no fallback path, failed on every
    message, while diet chart generation silently served FoodOScope charts and
    so still looked healthy. A retired ID must therefore cost one call and
    then be routed around, not take the feature down until someone redeploys.
    """

    def test_the_url_names_the_active_model(self, monkeypatch):
        with_keys(monkeypatch, "k")
        with patch("gemini_service.requests.post", return_value=candidates_response("hi")) as post:
            gemini_service._post_gemini({}, timeout=5)
        assert gemini_service.active_model() in post.call_args.args[0]

    def test_a_retired_model_falls_through_to_the_next_one(self, monkeypatch):
        with_keys(monkeypatch, "k")
        with patch(
            "gemini_service.requests.post",
            side_effect=[model_gone_response(), candidates_response("ok")],
        ) as post:
            body = gemini_service._post_gemini({}, timeout=5)

        assert body["candidates"][0]["content"]["parts"][0]["text"] == "ok"
        first, second = post.call_args_list[0].args[0], post.call_args_list[1].args[0]
        assert first != second

    def test_a_retired_model_does_not_burn_the_key_pool(self, monkeypatch):
        """The model being gone says nothing about the keys — parking them for
        it would take every other Gemini feature down too."""
        with_keys(monkeypatch, "a", "b")
        with patch(
            "gemini_service.requests.post",
            side_effect=[model_gone_response(), candidates_response("ok")],
        ) as post:
            gemini_service._post_gemini({}, timeout=5)

        assert gemini_service._cooldown_until == {}
        assert post.call_args_list[0].kwargs["params"] == {"key": "a"}
        assert post.call_args_list[1].kwargs["params"] == {"key": "a"}

    def test_the_working_model_sticks_for_later_calls(self, monkeypatch):
        with_keys(monkeypatch, "k")
        with patch(
            "gemini_service.requests.post",
            side_effect=[model_gone_response(), candidates_response("ok")],
        ):
            gemini_service._post_gemini({}, timeout=5)
        survivor = gemini_service.active_model()

        with patch("gemini_service.requests.post", return_value=candidates_response("ok")) as post:
            gemini_service._post_gemini({}, timeout=5)

        assert post.call_count == 1
        assert survivor in post.call_args.args[0]

    def test_a_pinned_model_is_tried_first(self, monkeypatch):
        with_keys(monkeypatch, "k")
        monkeypatch.setattr(gemini_service.settings, "GEMINI_MODEL", "gemini-pinned")
        gemini_service._resolved_model = None
        assert gemini_service.active_model() == "gemini-pinned"

    def test_giving_up_names_the_model_problem(self, monkeypatch):
        with_keys(monkeypatch, "k")
        with patch("gemini_service.requests.post", return_value=model_gone_response()):
            with pytest.raises(GeminiUnavailable, match="no usable model"):
                gemini_service._post_gemini({}, timeout=5)


class TestModelOverload:
    """A 503 UNAVAILABLE — "this model is currently experiencing high demand".

    This is the failure the patient actually saw: the message came back as
    "Gemini is unavailable (last error: HTTP 503 (UNAVAILABLE — This model is
    currently experiencing high demand))". It fell into the generic 5xx branch,
    which blames the key: all three keys were spent against the same busy model
    with no pause between them, and all three were left cooling down afterwards,
    so the next few minutes of requests failed too. Capacity belongs to the
    model, not the key.
    """

    @pytest.fixture(autouse=True)
    def no_real_sleeping(self, monkeypatch):
        """Keep the backoff's shape without paying for it in test time."""
        self.slept = []
        monkeypatch.setattr(gemini_service.time, "sleep", self.slept.append)

    def test_one_busy_answer_is_retried_on_the_same_key(self, monkeypatch):
        with_keys(monkeypatch, "a", "b")
        with patch(
            "gemini_service.requests.post",
            side_effect=[overloaded_response(), candidates_response("ok")],
        ) as post:
            body = gemini_service._post_gemini({}, timeout=5)

        assert body["candidates"][0]["content"]["parts"][0]["text"] == "ok"
        assert post.call_args_list[0].kwargs["params"] == {"key": "a"}
        assert post.call_args_list[1].kwargs["params"] == {"key": "a"}

    def test_it_waits_before_retrying(self, monkeypatch):
        with_keys(monkeypatch, "a")
        with patch(
            "gemini_service.requests.post",
            side_effect=[overloaded_response(), candidates_response("ok")],
        ):
            gemini_service._post_gemini({}, timeout=5)

        assert self.slept == [gemini_service._OVERLOAD_BACKOFF]

    def test_a_busy_model_escalates_to_another_model(self, monkeypatch):
        """The point of the fix: another model is a separate serving pool, so
        it is the retry with a real chance of working."""
        with_keys(monkeypatch, "k")
        with patch(
            "gemini_service.requests.post",
            side_effect=[
                overloaded_response(),
                overloaded_response(),
                candidates_response("ok"),
            ],
        ) as post:
            body = gemini_service._post_gemini({}, timeout=5)

        assert body["candidates"][0]["content"]["parts"][0]["text"] == "ok"
        first = post.call_args_list[0].args[0]
        assert post.call_args_list[1].args[0] == first
        assert post.call_args_list[2].args[0] != first

    def test_a_busy_model_does_not_burn_the_key_pool(self, monkeypatch):
        with_keys(monkeypatch, "a", "b", "c")
        with patch(
            "gemini_service.requests.post",
            side_effect=[
                overloaded_response(),
                overloaded_response(),
                candidates_response("ok"),
            ],
        ):
            gemini_service._post_gemini({}, timeout=5)

        assert gemini_service._cooldown_until == {}

    def test_a_busy_model_is_not_retired(self, monkeypatch):
        """Capacity comes back. Retiring the best model for the life of the
        process would answer a ten-second outage with a permanent downgrade."""
        with_keys(monkeypatch, "k")
        best = gemini_service.active_model()
        with patch(
            "gemini_service.requests.post",
            side_effect=[
                overloaded_response(),
                overloaded_response(),
                candidates_response("ok"),
            ],
        ):
            gemini_service._post_gemini({}, timeout=5)

        assert best not in gemini_service._retired_models

    def test_giving_up_says_busy_rather_than_broken(self, monkeypatch):
        with_keys(monkeypatch, "k")
        with patch("gemini_service.requests.post", return_value=overloaded_response()):
            with pytest.raises(GeminiUnavailable, match="busy"):
                gemini_service._post_gemini({}, timeout=5)

    def test_a_busy_model_is_bounded(self, monkeypatch):
        """A total outage must not turn one message into unbounded calls."""
        with_keys(monkeypatch, "k")
        with patch(
            "gemini_service.requests.post", return_value=overloaded_response()
        ) as post:
            with pytest.raises(GeminiUnavailable):
                gemini_service._post_gemini({}, timeout=5)

        assert post.call_count <= (
            gemini_service._MAX_MODEL_ATTEMPTS * gemini_service._OVERLOAD_ATTEMPTS
        )


class TestModelDiscovery:
    """Asking Gemini which models exist — the safety net for the day the
    static chain goes stale too."""

    def test_flash_models_rank_above_pro_and_preview(self):
        ranked = sorted(
            [
                "gemini-2.5-flash",
                "gemini-3.6-flash",
                "gemini-3.6-flash-lite",
                "gemini-3.6-flash-preview",
                "gemini-3.6-pro",
            ],
            key=gemini_service._model_rank,
            reverse=True,
        )
        assert ranked[0] == "gemini-3.6-flash"
        assert ranked[-1] == "gemini-3.6-pro"

    def test_non_text_models_are_not_candidates(self):
        assert gemini_service._is_usable_model("gemini-3.6-flash") is True
        for name in ("gemini-embedding-001", "gemini-2.5-flash-tts", "imagen-4.0", "gemma-3"):
            assert gemini_service._is_usable_model(name) is False

    def test_discovery_reads_the_live_list(self, monkeypatch):
        with_keys(monkeypatch, "k")
        gemini_service._discovered_models = None
        listing = Mock(status_code=200)
        listing.json.return_value = {
            "models": [
                {"name": "models/gemini-3.6-flash", "supportedGenerationMethods": ["generateContent"]},
                {"name": "models/gemini-2.5-flash", "supportedGenerationMethods": ["generateContent"]},
                {"name": "models/gemini-embedding-001", "supportedGenerationMethods": ["embedContent"]},
            ]
        }
        with patch("gemini_service.requests.get", return_value=listing):
            assert gemini_service._discover_models() == ["gemini-3.6-flash", "gemini-2.5-flash"]

    def test_a_failed_listing_is_not_fatal(self, monkeypatch):
        with_keys(monkeypatch, "k")
        gemini_service._discovered_models = None
        with patch("gemini_service.requests.get", side_effect=requests.ConnectionError("boom")):
            assert gemini_service._discover_models() == []

    def test_the_live_list_outranks_the_static_chain(self, monkeypatch):
        """A hard-coded ID is only right until the next retirement, and those
        have landed ahead of their published dates — so what the API says it
        can serve wins over what this file was written believing."""
        with_keys(monkeypatch, "k")
        monkeypatch.setattr(gemini_service.settings, "GEMINI_MODEL", "")
        gemini_service._discovered_models = ["gemini-9.9-flash"]

        assert gemini_service._model_candidates()[0] == "gemini-9.9-flash"
        assert gemini_service.active_model() == "gemini-9.9-flash"

    def test_a_pinned_model_still_outranks_the_live_list(self, monkeypatch):
        with_keys(monkeypatch, "k")
        monkeypatch.setattr(gemini_service.settings, "GEMINI_MODEL", "gemini-pinned")
        gemini_service._discovered_models = ["gemini-9.9-flash"]

        assert gemini_service._model_candidates()[0] == "gemini-pinned"

    def test_the_static_chain_backs_a_failed_listing(self, monkeypatch):
        with_keys(monkeypatch, "k")
        monkeypatch.setattr(gemini_service.settings, "GEMINI_MODEL", "")
        gemini_service._discovered_models = None
        with patch("gemini_service.requests.get", side_effect=requests.ConnectionError("boom")):
            assert gemini_service.active_model() == gemini_service._MODEL_CHAIN[0]

    def test_no_key_means_no_listing_request(self, monkeypatch):
        with_keys(monkeypatch)
        gemini_service._discovered_models = None
        with patch("gemini_service.requests.get") as get:
            assert gemini_service._discover_models() == []
        assert get.call_count == 0
        # Nothing was learned, so nothing should be remembered.
        assert gemini_service._discovered_models is None


class TestOutputBudget:
    """A reply that never arrives because the model spent the whole token
    budget thinking first — the migration hazard when moving off a model that
    did no internal reasoning."""

    def test_an_empty_reply_at_max_tokens_is_retried_with_more_room(self, monkeypatch):
        with_keys(monkeypatch, "k")
        spent = Mock(status_code=200)
        spent.json.return_value = {"candidates": [{"finishReason": "MAX_TOKENS", "content": {}}]}

        with patch(
            "gemini_service.requests.post",
            side_effect=[spent, candidates_response("here you go")],
        ) as post:
            answer = gemini_service.generate("hello", "rules", max_tokens=700)

        assert answer == "here you go"
        assert post.call_count == 2
        assert post.call_args_list[1].kwargs["json"]["generationConfig"]["maxOutputTokens"] == 2100

    def test_it_gives_up_rather_than_retrying_forever(self, monkeypatch):
        with_keys(monkeypatch, "k")
        spent = Mock(status_code=200)
        spent.json.return_value = {"candidates": [{"finishReason": "MAX_TOKENS", "content": {}}]}

        with patch("gemini_service.requests.post", return_value=spent) as post:
            with pytest.raises(GeminiUnavailable, match="output budget"):
                gemini_service.generate("hello", "rules", max_tokens=700)

        assert post.call_count == 2

    def test_a_blocked_prompt_says_so(self, monkeypatch):
        with_keys(monkeypatch, "k")
        blocked = Mock(status_code=200)
        blocked.json.return_value = {"candidates": [], "promptFeedback": {"blockReason": "SAFETY"}}

        with patch("gemini_service.requests.post", return_value=blocked):
            with pytest.raises(GeminiUnavailable, match="SAFETY"):
                gemini_service.generate("hello", "rules")


class TestGenerateHistory:
    def test_builds_multi_turn_contents_from_history(self, monkeypatch):
        captured = {}

        def fake_post_gemini(payload, timeout):
            captured["payload"] = payload
            return {"candidates": [{"content": {"parts": [{"text": "reply"}]}}]}

        monkeypatch.setattr(gemini_service, "_post_gemini", fake_post_gemini)
        gemini_service.generate(
            "new question",
            "rules",
            history=[
                {"role": "user", "text": "first"},
                {"role": "model", "text": "first reply"},
                {"role": "not-a-role", "text": "dropped: bad role"},
                {"role": "user", "text": "   "},  # blank after strip, dropped
            ],
        )
        contents = captured["payload"]["contents"]
        assert [c["role"] for c in contents] == ["user", "model", "user"]
        assert contents[0]["parts"][0]["text"] == "first"
        assert contents[-1]["parts"][0]["text"] == "new question"

    def test_a_leading_model_turn_is_dropped(self, monkeypatch):
        """The chatbot transcript opens with a canned welcome from the
        assistant, but Gemini requires a conversation to start with a user
        turn — sending it verbatim 400s on every single message."""
        captured = {}

        def fake_post_gemini(payload, timeout):
            captured["payload"] = payload
            return {"candidates": [{"content": {"parts": [{"text": "reply"}]}}]}

        monkeypatch.setattr(gemini_service, "_post_gemini", fake_post_gemini)
        gemini_service.generate(
            "hi",
            "rules",
            history=[
                {"role": "model", "text": "Namaste! I'm your wellness companion."},
                {"role": "user", "text": "hello"},
                {"role": "model", "text": "hello back"},
            ],
        )
        contents = captured["payload"]["contents"]
        assert [c["role"] for c in contents] == ["user", "model", "user"]
        assert contents[0]["parts"][0]["text"] == "hello"

    def test_consecutive_turns_of_one_role_are_merged(self, monkeypatch):
        captured = {}

        def fake_post_gemini(payload, timeout):
            captured["payload"] = payload
            return {"candidates": [{"content": {"parts": [{"text": "reply"}]}}]}

        monkeypatch.setattr(gemini_service, "_post_gemini", fake_post_gemini)
        gemini_service.generate(
            "and now?",
            "rules",
            history=[
                {"role": "user", "text": "one"},
                {"role": "model", "text": "reply one"},
                {"role": "model", "text": "reply two"},
            ],
        )
        contents = captured["payload"]["contents"]
        assert [c["role"] for c in contents] == ["user", "model", "user"]
        assert contents[1]["parts"][0]["text"] == "reply one\n\nreply two"

    def test_an_unanswered_question_is_folded_into_the_prompt(self, monkeypatch):
        """History ending on a user turn (the previous reply failed) must not
        produce two user turns in a row."""
        captured = {}

        def fake_post_gemini(payload, timeout):
            captured["payload"] = payload
            return {"candidates": [{"content": {"parts": [{"text": "reply"}]}}]}

        monkeypatch.setattr(gemini_service, "_post_gemini", fake_post_gemini)
        gemini_service.generate(
            "retry",
            "rules",
            history=[
                {"role": "user", "text": "one"},
                {"role": "model", "text": "reply one"},
                {"role": "user", "text": "unanswered"},
            ],
        )
        contents = captured["payload"]["contents"]
        assert [c["role"] for c in contents] == ["user", "model", "user"]
        assert contents[-1]["parts"][0]["text"] == "unanswered\n\nretry"

    def test_no_history_is_a_single_turn(self, monkeypatch):
        captured = {}

        def fake_post_gemini(payload, timeout):
            captured["payload"] = payload
            return {"candidates": [{"content": {"parts": [{"text": "reply"}]}}]}

        monkeypatch.setattr(gemini_service, "_post_gemini", fake_post_gemini)
        gemini_service.generate("hello", "rules")
        assert len(captured["payload"]["contents"]) == 1


class TestBuildChatPrompt:
    def test_empty_context_degrades_gracefully(self):
        block = gemini_service.build_chat_context_block({})
        assert "Active diet plan: none on file." in block
        assert "nothing logged yet" in block  # adherence / lifestyle
        assert "none logged yet" in block  # meal feedback
        assert "none recorded yet" in block  # screenings
        assert "RECIPE CANDIDATES" not in block

    def test_populated_context_includes_her_tracked_data(self):
        context = {
            "profile": {
                "lifeStage": "pregnancy",
                "trimester": "third",
                "dietaryPreference": "vegetarian",
                "allergies": ["nuts"],
            },
            "pantry": {"atHome": ["rice", "dal"], "toBuy": ["almonds"]},
            "mealAdherence": {
                "days": [
                    {"date": "2026-08-08", "eatenCount": 3, "totalMeals": 4, "caloriesConsumed": 1400}
                ]
            },
            "screenings": [
                {
                    "date": "2026-07-21",
                    "overallRisk": "low",
                    "conditions": [{"label": "Anaemia", "riskLevel": "low", "score": 8.0}],
                }
            ],
            "recipeCandidates": [
                {
                    "title": "Kheer",
                    "calories": 300,
                    "protein": 8,
                    "carbs": 40,
                    "fat": 9,
                    "cookTime": "25",
                    "region": "Indian Subcontinent",
                }
            ],
        }
        block = gemini_service.build_chat_context_block(context)
        assert "pregnancy" in block and "third trimester" in block
        assert "rice, dal" in block
        assert "almonds" in block
        assert "nuts" in block
        assert "Anaemia: LOW (score 8.0)" in block
        assert "RECIPE CANDIDATES" in block
        assert '"Kheer"' in block

    def test_no_identifiers_leak_into_the_prompt(self):
        """A name/email should never appear even if a caller mistakenly
        includes one — this module's payloads must stay non-identifiable."""
        context = {"profile": {"lifeStage": "pregnancy"}, "name": "Sneha Gupta"}
        block = gemini_service.build_chat_context_block(context)
        assert "Sneha" not in block

    def test_message_is_appended_after_the_context_block(self):
        prompt = gemini_service.build_chat_prompt("Any recipe ideas?", {})
        assert prompt.startswith("PATIENT CONTEXT")
        assert prompt.endswith("Any recipe ideas?")


class TestAssessAcnePhoto:
    """The PCOD/PCOS skin tracker's photo read.

    The patient's own severity rating is authoritative, so everything here is
    about the model *not* being trusted further than it should be: an
    unrecognised band, an invented region or a photo it cannot judge must all
    come back as "no opinion" rather than a guess the tracker then charts.
    """

    def test_returns_the_band_regions_and_description(self, monkeypatch):
        with_keys(monkeypatch, "key-a")
        response = candidates_response(
            '{"severity": "moderate", "regions": ["jawline", "chin"],'
            ' "observations": "Several inflamed papules along the jaw."}'
        )

        with patch("requests.post", return_value=response):
            result = gemini_service.assess_acne_photo("Zm9v", "image/jpeg")

        assert result["severity"] == "moderate"
        assert result["regions"] == ["jawline", "chin"]
        assert "inflamed" in result["observations"]

    def test_the_photo_is_sent_inline_beside_the_prompt(self, monkeypatch):
        with_keys(monkeypatch, "key-a")
        response = candidates_response('{"severity": "mild", "regions": []}')

        with patch("requests.post", return_value=response) as post:
            gemini_service.assess_acne_photo("Zm9v", "image/png")

        parts = post.call_args.kwargs["json"]["contents"][0]["parts"]
        assert parts[1]["inlineData"] == {"mimeType": "image/png", "data": "Zm9v"}

    def test_runs_at_zero_temperature(self, monkeypatch):
        """Description, not composition — the same rule report extraction uses."""
        with_keys(monkeypatch, "key-a")
        response = candidates_response('{"severity": "mild", "regions": []}')

        with patch("requests.post", return_value=response) as post:
            gemini_service.assess_acne_photo("Zm9v", "image/jpeg")

        assert post.call_args.kwargs["json"]["generationConfig"]["temperature"] == 0

    def test_an_unrecognised_severity_becomes_no_opinion(self, monkeypatch):
        with_keys(monkeypatch, "key-a")
        response = candidates_response('{"severity": "cystic", "regions": []}')

        with patch("requests.post", return_value=response):
            result = gemini_service.assess_acne_photo("Zm9v", "image/jpeg")

        assert result["severity"] is None

    def test_a_photo_it_cannot_judge_returns_null_rather_than_a_guess(self, monkeypatch):
        with_keys(monkeypatch, "key-a")
        response = candidates_response(
            '{"severity": null, "regions": [], "observations": "Too dark to judge."}'
        )

        with patch("requests.post", return_value=response):
            result = gemini_service.assess_acne_photo("Zm9v", "image/jpeg")

        assert result["severity"] is None
        assert result["observations"] == "Too dark to judge."

    def test_invented_regions_are_dropped(self, monkeypatch):
        with_keys(monkeypatch, "key-a")
        response = candidates_response(
            '{"severity": "mild", "regions": ["chin", "shoulder", 7]}'
        )

        with patch("requests.post", return_value=response):
            result = gemini_service.assess_acne_photo("Zm9v", "image/jpeg")

        assert result["regions"] == ["chin"]

    def test_observations_are_truncated(self, monkeypatch):
        with_keys(monkeypatch, "key-a")
        response = candidates_response(
            '{"severity": "mild", "regions": [], "observations": "%s"}' % ("x" * 900)
        )

        with patch("requests.post", return_value=response):
            result = gemini_service.assess_acne_photo("Zm9v", "image/jpeg")

        assert len(result["observations"]) == 500

    def test_unparseable_json_is_reported_as_unavailable(self, monkeypatch):
        with_keys(monkeypatch, "key-a")
        response = candidates_response("sorry, I can't help with that")

        with patch("requests.post", return_value=response):
            with pytest.raises(GeminiUnavailable):
                gemini_service.assess_acne_photo("Zm9v", "image/jpeg")

    def test_a_safety_block_is_reported_as_unavailable(self, monkeypatch):
        with_keys(monkeypatch, "key-a")
        response = Mock(status_code=200)
        response.json.return_value = {"candidates": []}

        with patch("requests.post", return_value=response):
            with pytest.raises(GeminiUnavailable):
                gemini_service.assess_acne_photo("Zm9v", "image/jpeg")
