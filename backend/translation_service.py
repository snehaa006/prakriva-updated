"""Machine translation, used by the ``/translate`` fallback endpoint.

The browser does the translating itself in the normal case: Google's public
``translate_a/single`` endpoint sends ``Access-Control-Allow-Origin: *``, so the
frontend can call it directly and no server is involved. Some networks block
that host, though, and a blocked request there means the whole site silently
stays in English. This module is the way out: the same call, made server-side,
where CORS and client-side blocking do not apply.

Kept deliberately small — no API key, no account, one dependency (``requests``)
that the backend already had. Results are memoised in-process, so a phrase is
fetched once per language for the lifetime of the worker.
"""

from typing import Dict, List, Tuple

import requests
from loguru import logger

ENDPOINT = "https://translate.googleapis.com/translate_a/single"

# Characters per upstream request. The endpoint accepts more, but a shorter
# batch keeps a single failure from costing a whole page of text.
CHUNK_CHARS = 1200

REQUEST_TIMEOUT_SECONDS = 10

# Simple bounded memo: (source, target, text) -> translation.
_CACHE: Dict[Tuple[str, str, str], str] = {}
_CACHE_LIMIT = 20000


def _cache_put(key: Tuple[str, str, str], value: str) -> None:
    if len(_CACHE) >= _CACHE_LIMIT:
        # Drop the oldest tenth rather than clearing outright, so a busy worker
        # does not lose every phrase at once.
        for stale in list(_CACHE)[: _CACHE_LIMIT // 10]:
            _CACHE.pop(stale, None)
    _CACHE[key] = value


def _chunk(texts: List[str]) -> List[List[str]]:
    """Group phrases into request-sized batches."""
    chunks: List[List[str]] = []
    current: List[str] = []
    size = 0

    for text in texts:
        if current and size + len(text) > CHUNK_CHARS:
            chunks.append(current)
            current, size = [], 0
        current.append(text)
        size += len(text) + 1

    if current:
        chunks.append(current)
    return chunks


def _request(texts: List[str], target: str, source: str) -> List[str]:
    """Translate one batch. Raises on anything unusable."""
    response = requests.get(
        ENDPOINT,
        params={
            "client": "gtx",
            "sl": source,
            "tl": target,
            "dt": "t",
            "q": "\n".join(texts),
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()

    payload = response.json()
    segments = payload[0] if isinstance(payload, list) else None
    if not isinstance(segments, list):
        raise ValueError("unexpected translation response")

    joined = "".join(
        segment[0] for segment in segments if isinstance(segment, list) and segment and segment[0]
    )
    lines = joined.split("\n")

    # The response echoes each source segment, so a line count that does not
    # match the request means the segments were merged — the translations would
    # line up against the wrong phrases, which is worse than no translation.
    if len(lines) != len(texts):
        raise ValueError(f"got {len(lines)} lines for {len(texts)} phrases")

    return [line.strip() for line in lines]


def translate_batch(texts: List[str], target: str, source: str = "en") -> List[str]:
    """Translate ``texts``, returning a list of the same length and order.

    A phrase that could not be translated comes back unchanged, so callers can
    render the result without checking for holes.
    """
    if target == source:
        return list(texts)

    results: Dict[str, str] = {}
    missing: List[str] = []

    for text in texts:
        cached = _CACHE.get((source, target, text))
        if cached is not None:
            results[text] = cached
        elif text and text not in missing:
            missing.append(text)

    for batch in _chunk(missing):
        try:
            translations = _request(batch, target, source)
        except Exception as error:  # noqa: BLE001 - any failure degrades to English
            logger.warning(f"Translation batch failed ({target}): {error}")
            if len(batch) == 1:
                continue
            # A merged batch is worth one retry phrase by phrase; a network
            # failure will simply fail again, quickly.
            translations = []
            for phrase in batch:
                try:
                    translations.extend(_request([phrase], target, source))
                except Exception:  # noqa: BLE001
                    translations.append(phrase)

        for phrase, translated in zip(batch, translations):
            if not translated:
                continue
            results[phrase] = translated
            _cache_put((source, target, phrase), translated)

    return [results.get(text, text) for text in texts]
