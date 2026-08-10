"""Tests for POST /assistant/chat — the patient chatbot's Gemini endpoint.

`gemini_service.generate` is mocked throughout: these tests are about the
route's validation and error mapping, not about reaching Gemini itself.
"""
import os
import sys
from unittest.mock import Mock, patch

import pytest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app as flask_app
import gemini_service


@pytest.fixture
def client():
    flask_app.config["TESTING"] = True
    return flask_app.test_client()


class TestAssistantChat:
    def test_requires_a_message(self, client):
        resp = client.post("/assistant/chat", json={"context": {}})
        assert resp.status_code == 400

    def test_rejects_an_overly_long_message(self, client):
        resp = client.post("/assistant/chat", json={"message": "x" * 5000})
        assert resp.status_code == 400

    def test_rejects_a_non_json_body(self, client):
        resp = client.post("/assistant/chat", data="not json", content_type="text/plain")
        assert resp.status_code == 400

    def test_happy_path_returns_the_generated_answer(self, client):
        with patch.object(gemini_service, "generate", return_value="Here's a recipe idea...") as mock_generate:
            resp = client.post(
                "/assistant/chat",
                json={
                    "message": "I'm craving something sweet, any ideas?",
                    "history": [{"role": "user", "text": "hi"}, {"role": "model", "text": "hello!"}],
                    "context": {"pantry": {"atHome": ["milk", "jaggery"], "toBuy": []}},
                },
            )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["success"] is True
        assert body["data"]["answer"] == "Here's a recipe idea..."
        # The route should hand the history through to generate(), not drop it.
        assert mock_generate.call_args.kwargs["history"] == [
            {"role": "user", "text": "hi"},
            {"role": "model", "text": "hello!"},
        ]

    def test_malformed_history_entries_are_dropped_not_rejected(self, client):
        with patch.object(gemini_service, "generate", return_value="ok") as mock_generate:
            resp = client.post(
                "/assistant/chat",
                json={
                    "message": "hello",
                    "history": [
                        {"role": "user", "text": "kept"},
                        {"role": "narrator", "text": "wrong role"},
                        "not even a dict",
                        {"role": "model"},  # missing text
                    ],
                },
            )
        assert resp.status_code == 200
        assert mock_generate.call_args.kwargs["history"] == [{"role": "user", "text": "kept"}]

    def test_returns_503_when_gemini_is_unavailable(self, client):
        with patch.object(
            gemini_service, "generate", side_effect=gemini_service.GeminiUnavailable("no key")
        ):
            resp = client.post("/assistant/chat", json={"message": "hello"})
        assert resp.status_code == 503
        assert resp.get_json()["success"] is False

    def test_non_dict_context_is_ignored_rather_than_rejected(self, client):
        with patch.object(gemini_service, "generate", return_value="ok"):
            resp = client.post("/assistant/chat", json={"message": "hello", "context": "oops a string"})
        assert resp.status_code == 200


class TestChatSurvivesARetiredModel:
    """The whole chatbot outage, end to end.

    A configured model ID that Google has since shut down answers 404 to every
    request. Before, that reached the patient as "I couldn't reach your
    assistant" on every single message while the recipe/diet chart path hid
    the same failure behind its FoodOScope fallback — so the app looked like
    it had a broken chatbot rather than a dead model name.
    """

    @pytest.fixture(autouse=True)
    def pin_a_dead_model(self, monkeypatch):
        monkeypatch.setattr(gemini_service.settings, "GEMINI_API_KEYS", ["key-a"])
        monkeypatch.setattr(gemini_service.settings, "GEMINI_MODEL", "gemini-2.0-flash")
        gemini_service._resolved_model = None

    def test_the_patient_still_gets_an_answer(self, client):
        def fake_post(url, **kwargs):
            if "gemini-2.0-flash" in url:
                response = Mock(status_code=404)
                response.json.return_value = {
                    "error": {"status": "NOT_FOUND", "message": "is not found for API version v1beta"}
                }
                return response
            response = Mock(status_code=200)
            response.json.return_value = {
                "candidates": [{"content": {"parts": [{"text": "Try warm moong dal khichdi."}]}}]
            }
            return response

        with patch("gemini_service.requests.post", side_effect=fake_post):
            resp = client.post("/assistant/chat", json={"message": "what should I eat?"})

        assert resp.status_code == 200
        assert resp.get_json()["data"]["answer"] == "Try warm moong dal khichdi."

    def test_the_status_endpoint_names_the_model_in_use(self, client):
        resp = client.get("/analysis/status")
        body = resp.get_json()["data"]
        assert body["enabled"] is True
        assert body["model"] == "gemini-2.0-flash"
