"""ML detectors for the anaemia and pregnancy-risk conditions.

Each has the standard detector signature ``(ScreeningInput) -> ConditionRisk``,
so `register_ml_detectors` can swap them in for the rule-based baseline without
anything downstream knowing which kind of detector answered.

When the inputs a model needs are missing (haemoglobin for anaemia; haemoglobin
and blood pressure for pregnancy risk), the detector falls back to the
rule-based baseline rather than feeding the model imputed values — a defaulted
haemoglobin would make anaemia scoring meaningless.
"""
from typing import List

from ..recommendations import get_recommendations
from ..rules import detect_anaemia, detect_gdm, detect_pregnancy_risk
from ..schemas import ConditionRisk, RiskLevel, ScreeningInput
from .inference import predict_from_screening, predict_gdm

ANAEMIA_DETECTOR = "anaemia-xgb-v1"
PREGNANCY_RISK_DETECTOR = "pregnancy-risk-xgb-v1"
GDM_DETECTOR = "gdm-logreg-v1"

#: Anemia grade -> (representative 0-100 score, risk level). Scores sit inside
#: the band `rules.classify` would assign, so mixed rules/ML runs stay coherent.
_ANAEMIA_MAP = {
    "Normal": (8.0, RiskLevel.LOW),
    "Mild": (45.0, RiskLevel.MODERATE),
    "Moderate": (72.0, RiskLevel.HIGH),
    "Severe": (92.0, RiskLevel.HIGH),
}

#: Pregnancy-risk class -> (representative 0-100 score, risk level).
_RISK_MAP = {
    "Low": (18.0, RiskLevel.LOW),
    "Medium": (52.0, RiskLevel.MODERATE),
    "High": (85.0, RiskLevel.HIGH),
}


def detect_anaemia_ml(inputs: ScreeningInput) -> ConditionRisk:
    """Anaemia grade from the XGBoost model, with a rule-based fallback."""
    if inputs.hemoglobin is None or inputs.hemoglobin <= 0:
        # Anaemia is defined by haemoglobin; without it, defer to the rules.
        return detect_anaemia(inputs)

    prediction = predict_from_screening(inputs)
    status = prediction.anemia_status
    score, risk_level = _ANAEMIA_MAP.get(status, (0.0, RiskLevel.LOW))

    reasons: List[str] = [
        f"Model grade: {status} anaemia "
        f"({prediction.anemia_confidence:.0%} confidence)",
        f"Haemoglobin {inputs.hemoglobin:.1f} g/dL",
    ]
    if inputs.anaemia_history:
        reasons.append("History of anaemia")

    return ConditionRisk(
        condition="anaemia",
        label="Anaemia",
        score=score,
        risk_level=risk_level,
        reasons=reasons,
        recommendations=get_recommendations("anaemia", risk_level),
        detector=ANAEMIA_DETECTOR,
        details={
            "anemia_status": status,
            "confidence": prediction.anemia_confidence,
        },
    )


def _risk_driver_reasons(inputs: ScreeningInput) -> List[str]:
    """Plain-language factors behind the pregnancy-risk score."""
    reasons: List[str] = []
    hb = inputs.hemoglobin
    if hb is not None and hb < 11:
        reasons.append(f"Low haemoglobin (Hb {hb:.1f} g/dL)")
    if inputs.bp_systolic is not None and inputs.bp_diastolic is not None:
        if inputs.bp_systolic >= 140 or inputs.bp_diastolic >= 90:
            reasons.append(
                f"Elevated blood pressure ({inputs.bp_systolic}/{inputs.bp_diastolic})"
            )
    if inputs.age >= 35:
        reasons.append(f"Maternal age {inputs.age}")
    elif inputs.age < 18:
        reasons.append(f"Young maternal age ({inputs.age})")
    if inputs.bmi is not None:
        if inputs.bmi >= 30:
            reasons.append(f"High BMI ({inputs.bmi:.1f})")
        elif inputs.bmi < 18.5:
            reasons.append(f"Low BMI ({inputs.bmi:.1f})")
    return reasons


def detect_pregnancy_risk_ml(inputs: ScreeningInput) -> ConditionRisk:
    """Overall pregnancy risk from the XGBoost model, with a rule-based fallback."""
    if inputs.hemoglobin is None or inputs.bp_systolic is None:
        # Too little to run the multi-factor model meaningfully — use the rules.
        return detect_pregnancy_risk(inputs)

    prediction = predict_from_screening(inputs)
    risk = prediction.pregnancy_risk
    score, risk_level = _RISK_MAP.get(risk, (0.0, RiskLevel.LOW))

    reasons: List[str] = [
        f"Model prediction: {risk} risk "
        f"({prediction.risk_confidence:.0%} confidence)",
        *_risk_driver_reasons(inputs),
    ]

    return ConditionRisk(
        condition="pregnancy_risk",
        label="Pregnancy Risk",
        score=score,
        risk_level=risk_level,
        reasons=reasons,
        recommendations=get_recommendations("pregnancy_risk", risk_level),
        detector=PREGNANCY_RISK_DETECTOR,
        details={
            "pregnancy_risk": risk,
            "confidence": prediction.risk_confidence,
        },
    )


_GDM_LEVELS = {
    "low": RiskLevel.LOW,
    "moderate": RiskLevel.MODERATE,
    "high": RiskLevel.HIGH,
}

#: Labels for the features the model may have to impute, for the reasons list.
_GDM_LAB_LABELS = {
    "hba1c_pct": "HbA1c",
    "hdl_mgdL": "HDL cholesterol",
    "triglycerides_mgdL": "triglycerides",
}


def _gdm_driver_reasons(inputs: ScreeningInput) -> List[str]:
    """Plain-language factors behind the GDM score."""
    reasons: List[str] = []
    if inputs.gestational_diabetes_previous:
        reasons.append("Gestational diabetes in a previous pregnancy")
    if inputs.known_prediabetes:
        reasons.append("Known prediabetes")
    if inputs.hba1c is not None and inputs.hba1c >= 5.7:
        reasons.append(f"HbA1c {inputs.hba1c:.1f}%")
    if inputs.bmi is not None and inputs.bmi >= 30:
        reasons.append(f"Obesity (BMI {inputs.bmi:.1f})")
    elif inputs.bmi is not None and inputs.bmi >= 25:
        reasons.append(f"Overweight (BMI {inputs.bmi:.1f})")
    if inputs.family_history:
        reasons.append("Family history of diabetes")
    if inputs.pcos:
        reasons.append("PCOS")
    if inputs.large_baby_previous:
        reasons.append("Previous large baby")
    if inputs.age >= 35:
        reasons.append(f"Maternal age {inputs.age}")
    return reasons


def _format_probability(probability: float) -> str:
    """Percentage that never reads as a certainty.

    A saturated logistic can round to 0% or 100%, which would present a
    screening estimate as a diagnosis. Clamp the *wording* at the extremes
    while leaving the underlying score untouched.
    """
    if probability >= 0.995:
        return ">99%"
    if probability <= 0.005:
        return "<1%"
    return f"{probability:.0%}"


def detect_gdm_ml(inputs: ScreeningInput) -> ConditionRisk:
    """Gestational diabetes risk from the logistic regression model.

    Falls back to the rule-based detector when BMI is unknown — BMI is the
    model's strongest routinely-available predictor, and imputing it would mean
    scoring a patient largely on population averages.
    """
    if inputs.bmi is None:
        return detect_gdm(inputs)

    prediction = predict_gdm(inputs)
    risk_level = _GDM_LEVELS[prediction.risk_level]

    reasons: List[str] = [
        f"Estimated gestational diabetes risk: {_format_probability(prediction.probability)}",
        *_gdm_driver_reasons(inputs),
    ]

    # Be explicit when labs were missing, so a score built partly on population
    # averages is never mistaken for one built on this patient's own results.
    missing_labs = [
        _GDM_LAB_LABELS[f]
        for f in prediction.imputed_features
        if f in _GDM_LAB_LABELS
    ]
    if missing_labs:
        reasons.append(
            "Estimated without " + ", ".join(missing_labs) + " — add for a sharper result"
        )

    return ConditionRisk(
        condition="gdm",
        label="Gestational Diabetes",
        score=round(prediction.probability * 100, 1),
        risk_level=risk_level,
        reasons=reasons,
        recommendations=get_recommendations("gdm", risk_level),
        detector=GDM_DETECTOR,
        details={
            "probability": prediction.probability,
            "imputed_features": prediction.imputed_features,
        },
    )


# `available_conditions()` reports this name for the active detector, so tag the
# functions with their versioned name (falls back to __name__ otherwise).
detect_anaemia_ml.detector_name = ANAEMIA_DETECTOR
detect_pregnancy_risk_ml.detector_name = PREGNANCY_RISK_DETECTOR
detect_gdm_ml.detector_name = GDM_DETECTOR
