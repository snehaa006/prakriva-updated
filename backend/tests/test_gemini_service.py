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
    """Every test starts with a clean pool and no keys configured."""
    with_keys(monkeypatch)
    gemini_service._cooldown_until.clear()
    gemini_service._active_key_index = 0
    yield
    gemini_service._cooldown_until.clear()
    gemini_service._active_key_index = 0


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
        """A 404 (e.g. unknown model) would fail identically on every key, so
        it should be raised immediately rather than burning the rotation."""
        with_keys(monkeypatch, "a", "b")
        with patch("gemini_service.requests.post", return_value=Mock(status_code=404)) as mock_post:
            with pytest.raises(GeminiUnavailable, match="404"):
                gemini_service._post_gemini({}, timeout=5)
        assert mock_post.call_count == 1

    def test_a_network_error_moves_to_the_next_key(self, monkeypatch):
        with_keys(monkeypatch, "a", "b")
        with patch(
            "gemini_service.requests.post",
            side_effect=[requests.ConnectionError("boom"), candidates_response("ok")],
        ):
            body = gemini_service._post_gemini({}, timeout=5)
        assert body["candidates"][0]["content"]["parts"][0]["text"] == "ok"


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
