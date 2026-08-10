"""Pytest configuration for the backend suite.

`db.py` builds a Supabase client at import time and raises when
`SUPABASE_SERVICE_ROLE_KEY` is missing, so importing `app` at all requires
credentials. The tests mock every database call anyway, so supply placeholders
here and let the suite run offline without a real project.

Set before any test module is imported — pytest loads conftest first.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# supabase-py validates that the key parses as a JWT, so the placeholder has to
# be JWT-shaped rather than an arbitrary string. It is never sent anywhere.
PLACEHOLDER_JWT = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzAwMDAwMDAwfQ"
    ".placeholder-signature-not-used-by-tests"
)

os.environ.setdefault("SUPABASE_URL", "https://placeholder.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", PLACEHOLDER_JWT)
os.environ.setdefault("FLASK_ENV", "testing")


def pytest_configure(config):
    """Register the markers the suite uses so `-W error` stays usable."""
    config.addinivalue_line("markers", "integration: marks tests as integration tests")
    config.addinivalue_line("markers", "performance: marks tests as performance tests")


@pytest.fixture(autouse=True)
def reset_gemini_model_state():
    """Give every test a fresh model chain, and never let one reach the network.

    `gemini_service` remembers which model IDs have been retired for the life
    of the process — a test that stubs a 404 would otherwise retire the whole
    chain for every test after it, and exhausting the chain is exactly what
    makes the real code go and ask Gemini which models exist. Seeding the
    discovery cache with an empty list keeps that request from ever firing.
    """
    import gemini_service

    def reset():
        gemini_service._retired_models.clear()
        gemini_service._resolved_model = None
        gemini_service._discovered_models = []

    reset()
    yield
    reset()
