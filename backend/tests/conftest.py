"""Pytest configuration for the backend suite.

`db.py` builds a Supabase client at import time and raises when
`SUPABASE_SERVICE_ROLE_KEY` is missing, so importing `app` at all requires
credentials. The tests mock every database call anyway, so supply placeholders
here and let the suite run offline without a real project.

Set before any test module is imported — pytest loads conftest first.
"""
import os
import sys

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
