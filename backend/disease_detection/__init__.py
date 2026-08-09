"""Maternal disease detection pipeline.

The pipeline screens a pregnant patient for seven conditions (anaemia, GDM,
preeclampsia, UTI, thyroid disorder, miscarriage risk and perinatal mental
health) and returns a per-condition risk score, the factors that drove it and
clinical next steps.

The detectors registered by default are the rule-based scorers ported from the
Neuviaa analytics prototype (`rules.py`). They are deliberately isolated behind
`pipeline.register_detector`, so a trained ML model can replace any single
condition later without touching the API layer or the frontend — see
`pipeline.py` for the contract a detector has to satisfy.
"""

from .pipeline import (
    available_conditions,
    get_detector,
    register_detector,
    reset_detectors,
    run_screening,
)
from .schemas import (
    CONDITIONS,
    ConditionRisk,
    RiskLevel,
    ScreeningInput,
    ScreeningResult,
    SYMPTOMS,
)

# Swap the trained anaemia + pregnancy-risk models in for their rule-based
# baselines when their artifacts are available. This is a no-op (and logs a
# warning) if the models or XGBoost are missing, so the rule-based pipeline
# keeps working either way.
from .ml import register_ml_detectors

register_ml_detectors()

__all__ = [
    "CONDITIONS",
    "SYMPTOMS",
    "ConditionRisk",
    "RiskLevel",
    "ScreeningInput",
    "ScreeningResult",
    "available_conditions",
    "get_detector",
    "register_detector",
    "reset_detectors",
    "run_screening",
]
