"""Trained-model detectors for the maternal disease pipeline.

Kept import-light on purpose: importing this package must not require the model
artifacts or XGBoost to be present (training runs before the models exist, and
the rule-based baseline must keep working if the models fail to load). The
actual model loading happens lazily inside `register_ml_detectors`.
"""


def register_ml_detectors(replace: bool = True) -> bool:
    """Swap the ML anemia + pregnancy-risk detectors into the pipeline.

    Returns True when the models loaded and both detectors were registered,
    False when they could not (missing artifacts or XGBoost) — in which case
    the rule-based baseline detectors stay in place. Never raises.
    """
    try:
        from .detectors import (
            detect_anaemia_ml,
            detect_gdm_ml,
            detect_pregnancy_risk_ml,
        )
        from .inference import warm_up

        # Fail fast (and quietly fall back) if the artifacts are missing.
        warm_up()

        from ..pipeline import register_detector

        register_detector("anaemia", detect_anaemia_ml, replace=replace)
        register_detector("pregnancy_risk", detect_pregnancy_risk_ml, replace=replace)
        register_detector("gdm", detect_gdm_ml, replace=replace)
        return True
    except Exception as exc:  # noqa: BLE001 - fall back to rules on any failure
        try:
            from loguru import logger

            logger.warning(
                f"Maternal ML models not loaded; using rule-based baseline. ({exc})"
            )
        except Exception:  # pragma: no cover - logging must never break startup
            pass
        return False


__all__ = ["register_ml_detectors"]
