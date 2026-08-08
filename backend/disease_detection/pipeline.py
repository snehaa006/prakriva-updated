"""Detector registry and screening orchestration.

A *detector* is any callable with the signature::

    (inputs: ScreeningInput) -> ConditionRisk

The rule-based scorers in `rules.py` are registered as the baseline. Swapping in
a trained model for one condition is a single call at import time — nothing else
in the stack knows which kind of detector answered::

    from disease_detection import register_detector

    def detect_anaemia_ml(inputs):
        proba = MODEL.predict_proba(featurise(inputs))[0][1]
        return ConditionRisk(
            condition="anaemia",
            label=CONDITIONS["anaemia"],
            score=round(proba * 100, 1),
            risk_level=classify(proba * 100),
            reasons=explain(inputs),
            recommendations=get_recommendations("anaemia", ...),
            detector="anaemia-xgb-v2",
        )

    register_detector("anaemia", detect_anaemia_ml, replace=True)

`ConditionRisk.detector` records which one ran, so a mixed rules/ML screening
stays auditable.
"""
from typing import Callable, Dict, Iterable, List, Optional

from .rules import BASELINE_DETECTORS
from .schemas import (
    CONDITIONS,
    ConditionRisk,
    RiskLevel,
    ScreeningInput,
    ScreeningResult,
)

Detector = Callable[[ScreeningInput], ConditionRisk]

_REGISTRY: Dict[str, Detector] = {}

#: Risk levels ordered least to most severe, for picking the overall verdict.
_SEVERITY = [RiskLevel.LOW, RiskLevel.MODERATE, RiskLevel.HIGH]


class UnknownConditionError(ValueError):
    """Raised when a caller asks for a condition with no registered detector."""


def register_detector(
    condition: str, detector: Detector, *, replace: bool = False
) -> None:
    """Register `detector` as the scorer for `condition`.

    Registering over an existing condition requires `replace=True` so a stray
    import cannot silently take over a condition's scoring.
    """
    if condition not in CONDITIONS:
        raise UnknownConditionError(
            f"Unknown condition '{condition}'. Known: {', '.join(sorted(CONDITIONS))}"
        )
    if condition in _REGISTRY and not replace:
        raise ValueError(
            f"A detector for '{condition}' is already registered; "
            "pass replace=True to override it."
        )
    _REGISTRY[condition] = detector


def get_detector(condition: str) -> Detector:
    """The detector currently registered for `condition`."""
    try:
        return _REGISTRY[condition]
    except KeyError:
        raise UnknownConditionError(
            f"No detector registered for '{condition}'"
        ) from None


def available_conditions() -> List[Dict[str, str]]:
    """Screenable conditions with their labels and active detector name."""
    return [
        {
            "condition": condition,
            "label": CONDITIONS[condition],
            "detector": getattr(detector, "detector_name", detector.__name__),
        }
        for condition, detector in _REGISTRY.items()
    ]


def reset_detectors() -> None:
    """Restore the baseline rule-based detectors. Mainly for tests."""
    _REGISTRY.clear()
    for condition, detector in BASELINE_DETECTORS.items():
        _REGISTRY[condition] = detector


def run_screening(
    inputs: ScreeningInput, conditions: Optional[Iterable[str]] = None
) -> ScreeningResult:
    """Score `inputs` for `conditions` (all registered ones by default)."""
    selected = list(conditions) if conditions is not None else list(_REGISTRY)

    results: List[ConditionRisk] = []
    for condition in selected:
        results.append(get_detector(condition)(inputs))

    # Highest score first so the doctor reads the worrying conditions first.
    results.sort(key=lambda risk: risk.score, reverse=True)

    overall = RiskLevel.LOW
    for risk in results:
        if _SEVERITY.index(risk.risk_level) > _SEVERITY.index(overall):
            overall = risk.risk_level

    return ScreeningResult(
        conditions=results,
        overall_risk_level=overall,
        highest_risk_condition=results[0].condition if results else None,
    )


reset_detectors()
