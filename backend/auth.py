"""
Bearer-token authentication for the Flask API.

Why this exists at all: this service holds the Supabase **service role** key,
which bypasses every Row Level Security policy in the database. RLS protects
Postgres from the browser; it cannot protect a server that already has the
master key. So any route reachable here has to establish who is calling before
it touches patient data — the database will not do it for us.

Two rules follow from that, and both are load-bearing:

1. Identity comes from the verified token, never from the request. A `user_id`
   in a path or body is a claim, not a fact; trusting one turns every endpoint
   into an "any patient's records" endpoint.
2. Everything fails closed. A missing token, an expired token, an unreachable
   auth server or a failed role lookup all deny the request rather than falling
   through to the handler.
"""

from functools import wraps
from typing import Any, Optional, Tuple

from flask import g, jsonify, request
from loguru import logger
from supabase import create_client

from config import settings

# Built lazily and reused: create_client opens connections, and doing that per
# request would add a handshake to every authenticated call.
_auth_client = None


def _client():
    global _auth_client
    if _auth_client is None:
        _auth_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )
    return _auth_client


def _bearer_token() -> Optional[str]:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    return header[7:].strip() or None


def _unauthorised(message: str) -> Tuple[Any, int]:
    return jsonify({"success": False, "error": message}), 401


def _forbidden(message: str) -> Tuple[Any, int]:
    return jsonify({"success": False, "error": message}), 403


def _authenticate() -> Tuple[Optional[Any], Optional[Tuple[Any, int]]]:
    """Returns (user, error_response). Exactly one is ever non-None."""
    token = _bearer_token()
    if not token:
        return None, _unauthorised("Authorization header with a bearer token is required.")

    try:
        # Asks Supabase to validate the token rather than trusting our own
        # decode: this catches revoked sessions and signing-key rotation, which
        # a local signature check would happily accept.
        response = _client().auth.get_user(token)
    except Exception as exc:
        logger.warning(f"Token rejected by Supabase: {exc}")
        return None, _unauthorised("Invalid or expired token.")

    user = getattr(response, "user", None)
    if user is None or not getattr(user, "id", None):
        return None, _unauthorised("Invalid or expired token.")

    return user, None


def _is_admin(user_id: str) -> bool:
    try:
        from db import db_manager

        result = (
            db_manager.db.table("profiles")
            .select("role")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        return bool(rows) and rows[0].get("role") == "admin"
    except Exception as exc:
        # A lookup we could not complete is not permission to proceed.
        logger.error(f"Admin role check failed for {user_id}: {exc}")
        return False


def require_auth(view):
    """Rejects anonymous callers and puts the verified id on `g.user_id`."""

    @wraps(view)
    def wrapped(*args, **kwargs):
        user, error = _authenticate()
        if error:
            return error
        g.user_id = str(user.id)
        g.user_email = getattr(user, "email", None)
        return view(*args, **kwargs)

    return wrapped


def require_admin(view):
    """As `require_auth`, and the caller's profile role must be `admin`."""

    @wraps(view)
    def wrapped(*args, **kwargs):
        user, error = _authenticate()
        if error:
            return error
        g.user_id = str(user.id)
        g.user_email = getattr(user, "email", None)
        if not _is_admin(g.user_id):
            logger.warning(f"Non-admin {g.user_id} attempted {request.path}")
            return _forbidden("This endpoint is restricted to administrators.")
        return view(*args, **kwargs)

    return wrapped


def require_self(param: str = "user_id"):
    """
    For routes that carry a user id in the URL.

    The route keeps its readable shape while the id is checked against the
    token, so `/user/<someone-else>/plans` returns 403 instead of their data.
    Handlers should still prefer `g.user_id` over the path value.
    """

    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            user, error = _authenticate()
            if error:
                return error
            g.user_id = str(user.id)
            g.user_email = getattr(user, "email", None)

            claimed = kwargs.get(param)
            if claimed is not None and str(claimed) != g.user_id:
                logger.warning(
                    f"{g.user_id} attempted to read {param}={claimed} on {request.path}"
                )
                return _forbidden("You can only access your own records.")
            return view(*args, **kwargs)

        return wrapped

    return decorator
