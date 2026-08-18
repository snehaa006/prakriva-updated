"""Tests for the machine-translation fallback used by /translate."""

import pytest

import translation_service


class _FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status = status

    def raise_for_status(self):
        if self.status >= 400:
            raise RuntimeError(f"HTTP {self.status}")

    def json(self):
        return self._payload


def _google_payload(texts, prefix="»"):
    """Shape a gtx response that echoes each source segment, as the real one does."""
    segments = []
    for index, text in enumerate(texts):
        suffix = "" if index == len(texts) - 1 else "\n"
        segments.append([f"{prefix}{text}{suffix}", f"{text}{suffix}", None, None, 3])
    return [segments, None, "en"]


@pytest.fixture(autouse=True)
def clear_cache():
    translation_service._CACHE.clear()
    yield
    translation_service._CACHE.clear()


def test_translates_a_batch(monkeypatch):
    calls = []

    def fake_get(url, params, timeout):
        calls.append(params)
        return _FakeResponse(_google_payload(params["q"].split("\n")))

    monkeypatch.setattr(translation_service.requests, "get", fake_get)

    result = translation_service.translate_batch(["Dashboard", "Health Check"], "hi")

    assert result == ["»Dashboard", "»Health Check"]
    assert len(calls) == 1


def test_second_call_is_served_from_cache(monkeypatch):
    calls = []

    def fake_get(url, params, timeout):
        calls.append(params)
        return _FakeResponse(_google_payload(params["q"].split("\n")))

    monkeypatch.setattr(translation_service.requests, "get", fake_get)

    translation_service.translate_batch(["Dashboard"], "hi")
    translation_service.translate_batch(["Dashboard"], "hi")

    assert len(calls) == 1


def test_same_language_is_a_passthrough(monkeypatch):
    def fail(*args, **kwargs):  # pragma: no cover - must never be reached
        raise AssertionError("no request should be made")

    monkeypatch.setattr(translation_service.requests, "get", fail)

    assert translation_service.translate_batch(["Dashboard"], "en", "en") == ["Dashboard"]


def test_misaligned_batch_is_retried_one_phrase_at_a_time(monkeypatch):
    calls = []

    def fake_get(url, params, timeout):
        calls.append(params["q"])
        phrases = params["q"].split("\n")
        # The batched call merges the two phrases into a single segment.
        if len(phrases) > 1:
            return _FakeResponse(_google_payload(["Dashboard Health Check"]))
        return _FakeResponse(_google_payload(phrases))

    monkeypatch.setattr(translation_service.requests, "get", fake_get)

    result = translation_service.translate_batch(["Dashboard", "Health Check"], "hi")

    assert result == ["»Dashboard", "»Health Check"]
    assert len(calls) == 3


def test_failure_degrades_to_the_source_text(monkeypatch):
    def fake_get(url, params, timeout):
        raise RuntimeError("network down")

    monkeypatch.setattr(translation_service.requests, "get", fake_get)

    assert translation_service.translate_batch(["Dashboard"], "hi") == ["Dashboard"]


class TestTranslateEndpoint:
    """The /translate route: validation, and the happy path."""

    @pytest.fixture
    def client(self):
        from app import app as flask_app

        flask_app.config["TESTING"] = True
        return flask_app.test_client()

    def test_returns_translations_in_order(self, client, monkeypatch):
        monkeypatch.setattr(
            translation_service,
            "translate_batch",
            lambda texts, target, source: [f"[{target}]{text}" for text in texts],
        )

        response = client.post(
            "/translate",
            json={"texts": ["Dashboard", "Health Check"], "target": "hi"},
        )

        assert response.status_code == 200
        assert response.get_json()["translations"] == ["[hi]Dashboard", "[hi]Health Check"]

    def test_rejects_a_missing_target(self, client):
        response = client.post("/translate", json={"texts": ["Dashboard"]})
        assert response.status_code == 400

    def test_rejects_an_empty_batch(self, client):
        response = client.post("/translate", json={"texts": [], "target": "hi"})
        assert response.status_code == 400
