"""
Vercel Python function entrypoint.

Vercel's zero-config Python runtime auto-detects files under /api and wraps
whatever WSGI/ASGI app they expose. The real Flask app lives in
backend/app.py (kept there so `python app.py` / `python run.py` still work
for local development) - this just points sys.path at backend/ and
re-exports its `app` object.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

from app import app  # noqa: E402
