"""Rule-based baseline detectors.

These are the weighted-scoring rules from the Neuviaa analytics prototype
(`backend2/model/health_risk_app.py` plus the standalone `evaluate_*.py`
scorers), ported onto `ScreeningInput` and packaged one function per condition.

Each function is a *detector*: it takes a `ScreeningInput` and returns a
`ConditionRisk`. That signature is the whole contract, so a trained model can
be dropped in per condition later without changing anything downstream.
"""
from typing import List, Optional, Tuple

from .recommendations import get_recommendations
from .schemas import CONDITIONS, ConditionRisk, RiskLevel, ScreeningInput, TernaryEnum

DETECTOR_VERSION = "rules-v1"

#: Score thresholds shared by every rule-based detector.
HIGH_RISK_THRESHOLD = 60
MODERATE_RISK_THRESHOLD = 30


def classify(score: float) -> RiskLevel:
    """Map a 0-100 score onto a risk level."""
    if score >= HIGH_RISK_THRESHOLD:
        return RiskLevel.HIGH
    if score >= MODERATE_RISK_THRESHOLD:
        return RiskLevel.MODERATE
    return RiskLevel.LOW


def _build(
    condition: str,
    score: float,
    reasons: List[str],
    details: Optional[dict] = None,
) -> ConditionRisk:
    """Wrap a raw score into a `ConditionRisk`, capped at 100."""
    capped = min(max(score, 0), 100)
    risk_level = classify(capped)
    return ConditionRisk(
        condition=condition,
        label=CONDITIONS[condition],
        score=round(capped, 1),
        risk_level=risk_level,
        reasons=reasons,
        recommendations=get_recommendations(condition, risk_level),
        detector=DETECTOR_VERSION,
        details=details or {},
    )


def _blood_pressure(inputs: ScreeningInput) -> Tuple[Optional[int], Optional[int]]:
    return inputs.bp_systolic, inputs.bp_diastolic


# ---------------------------------------------------------------------------
# Detectors
# ---------------------------------------------------------------------------


def detect_anaemia(inputs: ScreeningInput) -> ConditionRisk:
    """Anaemia risk from haemoglobin, history and the classic symptom cluster."""
    score = 0.0
    reasons: List[str] = []

    hb = inputs.hemoglobin
    if hb is not None and hb > 0:
        if hb < 7:
            score += 40
            reasons.append(f"Severe anaemia (Hb {hb:.1f} g/dL)")
        elif hb < 10:
            score += 30
            reasons.append(f"Moderate anaemia (Hb {hb:.1f} g/dL)")
        elif hb < 11:
            score += 20
            reasons.append(f"Mild anaemia (Hb {hb:.1f} g/dL)")

    if inputs.anaemia_history:
        score += 15
        reasons.append("History of anaemia")

    if inputs.has_any("fatigue", "dizziness"):
        score += 10
        reasons.append("Fatigue / dizziness reported")
    if inputs.has("pale_skin"):
        score += 10
        reasons.append("Pallor observed")
    if inputs.has("cold_hands_feet"):
        score += 8
        reasons.append("Cold extremities")
    if inputs.has("shortness_of_breath"):
        score += 8
        reasons.append("Shortness of breath")
    if inputs.has("palpitations"):
        score += 7
        reasons.append("Palpitations")
    if inputs.has("headache"):
        score += 5
        reasons.append("Frequent headaches")

    if inputs.gravida >= 3:
        score += 5
        reasons.append(f"Multiple pregnancies (gravida {inputs.gravida})")

    # The third trimester is when plasma volume expansion bites hardest.
    if inputs.trimester == "third":
        score += 8
        reasons.append("Third trimester — peak iron demand")

    symptom_count = sum(
        inputs.has(s)
        for s in (
            "fatigue",
            "dizziness",
            "pale_skin",
            "cold_hands_feet",
            "shortness_of_breath",
            "palpitations",
            "headache",
        )
    )
    if symptom_count >= 5:
        score += 10
        reasons.append("Multiple concurrent anaemia symptoms")
    elif symptom_count >= 3:
        score += 5

    return _build("anaemia", score, reasons, {"symptom_count": symptom_count})


def detect_gdm(inputs: ScreeningInput) -> ConditionRisk:
    """Gestational diabetes risk from glycaemic labs, BMI and obstetric history."""
    score = 0.0
    reasons: List[str] = []

    bmi = inputs.bmi
    if bmi is not None:
        if bmi > 30:
            score += 20
            reasons.append(f"Obesity (BMI {bmi:.1f})")
        elif bmi > 25:
            score += 10
            reasons.append(f"Overweight (BMI {bmi:.1f})")

    if inputs.gestational_diabetes_previous:
        score += 30
        reasons.append("Gestational diabetes in a previous pregnancy")

    if inputs.hba1c is not None and inputs.hba1c > 0:
        if inputs.hba1c >= 6.5:
            score += 35
            reasons.append(f"HbA1c {inputs.hba1c:.1f}% — diabetes range")
        elif inputs.hba1c >= 5.7:
            score += 20
            reasons.append(f"HbA1c {inputs.hba1c:.1f}% — prediabetes range")

    if inputs.ogtt_1hr is not None and inputs.ogtt_1hr > 0:
        if inputs.ogtt_1hr >= 180:
            score += 25
            reasons.append(f"High 1-hour OGTT ({inputs.ogtt_1hr:.0f} mg/dL)")
        elif inputs.ogtt_1hr >= 140:
            score += 15
            reasons.append(f"Elevated 1-hour OGTT ({inputs.ogtt_1hr:.0f} mg/dL)")

    if inputs.excessive_thirst:
        score += 10
        reasons.append("Excessive thirst (polydipsia)")
    if inputs.large_baby_previous:
        score += 12
        reasons.append("Previous macrosomic baby")
    if inputs.unexplained_prenatal_loss:
        score += 8
        reasons.append("Unexplained prenatal loss")
    if inputs.pcos:
        score += 10
        reasons.append("PCOS")
    if inputs.family_history:
        score += 10
        reasons.append("Family history of diabetes")
    if inputs.age > 35:
        score += 8
        reasons.append(f"Advanced maternal age ({inputs.age})")
    if inputs.sedentary_lifestyle:
        score += 5
        reasons.append("Sedentary lifestyle")

    return _build("gdm", score, reasons)


def detect_preeclampsia(inputs: ScreeningInput) -> ConditionRisk:
    """Preeclampsia risk from blood pressure, proteinuria and warning symptoms."""
    score = 0.0
    reasons: List[str] = []

    systolic, diastolic = _blood_pressure(inputs)
    if systolic is not None or diastolic is not None:
        sys_bp = systolic or 0
        dia_bp = diastolic or 0
        if sys_bp >= 160 or dia_bp >= 110:
            score += 40
            reasons.append(f"Severe hypertension ({sys_bp}/{dia_bp} mmHg)")
        elif sys_bp >= 140 or dia_bp >= 90:
            score += 25
            reasons.append(f"Hypertension ({sys_bp}/{dia_bp} mmHg)")
        elif sys_bp >= 130:
            score += 10
            reasons.append(f"Elevated blood pressure ({sys_bp}/{dia_bp} mmHg)")

    if inputs.proteinuria == TernaryEnum.POSITIVE:
        score += 25
        reasons.append("Proteinuria positive")

    if inputs.has("blurred_vision"):
        score += 10
        reasons.append("Blurred vision")
    if inputs.has("headache"):
        score += 10
        reasons.append("Severe headache")
    if inputs.has("swelling"):
        score += 8
        reasons.append("Oedema / swelling")
    if inputs.has("lower_abdominal_pain"):
        score += 7
        reasons.append("Abdominal pain")

    if inputs.age > 35:
        score += 8
        reasons.append(f"Advanced maternal age ({inputs.age})")
    if inputs.bmi is not None and inputs.bmi > 30:
        score += 8
        reasons.append(f"Obesity (BMI {inputs.bmi:.1f})")
    if inputs.gravida == 1:
        score += 5
        reasons.append("First pregnancy")
    if inputs.family_history:
        score += 7
        reasons.append("Family history")
    if inputs.previous_complications:
        score += 8
        reasons.append("Previous pregnancy complications")

    return _build("preeclampsia", score, reasons)


def detect_uti(inputs: ScreeningInput) -> ConditionRisk:
    """UTI risk from urinary symptoms, urinalysis and history."""
    score = 0.0
    reasons: List[str] = []

    if inputs.has_any("painful_urination", "frequent_urination"):
        score += 35
        reasons.append("Urinary symptoms present")
    if inputs.has("painful_urination"):
        # Burning on micturition is the strongest single symptom in the
        # standalone UTI scorer, so it carries weight beyond the generic
        # "urinary symptoms" bucket above.
        score += 10
        reasons.append("Burning on urination")

    wbc = inputs.urine_wbc
    if wbc is not None:
        if wbc > 50:
            score += 40
            reasons.append(f"Very high urine WBC count ({wbc})")
        elif wbc > 10:
            score += 25
            reasons.append(f"Elevated urine WBC count ({wbc})")

    if inputs.urine_nitrite == TernaryEnum.POSITIVE:
        score += 15
        reasons.append("Positive urine nitrite")

    if inputs.has("cloudy_urine"):
        score += 10
        reasons.append("Cloudy or foul-smelling urine")
    if inputs.has("blood_in_urine"):
        score += 20
        reasons.append("Blood in urine — suggests upper tract involvement")
    if inputs.previous_uti:
        score += 10
        reasons.append("History of UTI")
    if inputs.has("fever"):
        score += 10
        reasons.append("Fever present")
    if inputs.has_any("lower_abdominal_pain", "back_pain"):
        score += 5
        reasons.append("Abdominal / back pain")

    return _build("uti", score, reasons)


def detect_thyroid(inputs: ScreeningInput) -> ConditionRisk:
    """Thyroid disorder risk, with a hypo/hyper sub-type from the TSH value."""
    score = 0.0
    reasons: List[str] = []
    thyroid_type = "Unknown — no TSH value"

    tsh = inputs.tsh
    if tsh is not None and tsh > 0:
        if tsh > 4.5:
            score += 40
            reasons.append(f"Elevated TSH ({tsh:.2f} mIU/L) — hypothyroidism suspected")
            thyroid_type = "Hypothyroidism (underactive)"
        elif tsh < 0.4:
            score += 35
            reasons.append(f"Low TSH ({tsh:.2f} mIU/L) — hyperthyroidism suspected")
            thyroid_type = "Hyperthyroidism (overactive)"
        else:
            thyroid_type = "Normal TSH range"

    if inputs.t3 is not None and inputs.t3 > 0:
        if inputs.t3 > 4.0:
            score += 15
            reasons.append(f"Elevated T3 ({inputs.t3:.2f})")
        elif inputs.t3 < 1.2:
            score += 10
            reasons.append(f"Low T3 ({inputs.t3:.2f})")

    if inputs.t4 is not None and inputs.t4 > 0:
        if inputs.t4 > 2.5:
            score += 15
            reasons.append(f"Elevated T4 ({inputs.t4:.2f})")
        elif inputs.t4 < 0.8:
            score += 10
            reasons.append(f"Low T4 ({inputs.t4:.2f})")

    if inputs.has("palpitations"):
        score += 8
        reasons.append("Palpitations")
    if inputs.weight_gain:
        score += 7
        reasons.append("Unexplained weight gain")
    if inputs.hair_loss:
        score += 6
        reasons.append("Hair loss")
    if inputs.cold_intolerance:
        score += 6
        reasons.append("Cold intolerance")
    if inputs.has("fatigue"):
        score += 5
        reasons.append("Fatigue")
    if inputs.constipation:
        score += 5
        reasons.append("Constipation")
    if inputs.menstrual_irregularity:
        score += 4
        reasons.append("Menstrual irregularity")
    if inputs.family_history:
        score += 5
        reasons.append("Family history")

    return _build("thyroid", score, reasons, {"thyroid_type": thyroid_type})


def detect_miscarriage(inputs: ScreeningInput) -> ConditionRisk:
    """Miscarriage risk from obstetric history, comorbidities and warning signs."""
    score = 0.0
    reasons: List[str] = []

    if inputs.has("bleeding"):
        score += 30
        reasons.append("Vaginal bleeding")
    if inputs.has("cramping"):
        score += 20
        reasons.append("Cramping")

    if inputs.previous_miscarriage:
        score += 25
        reasons.append("Previous miscarriage")
    if inputs.pcos:
        score += 15
        reasons.append("PCOS")

    if inputs.age >= 40:
        score += 25
        reasons.append(f"Very advanced maternal age ({inputs.age})")
    elif inputs.age > 35:
        score += 15
        reasons.append(f"Advanced maternal age ({inputs.age})")
    elif inputs.age < 20:
        score += 10
        reasons.append(f"Very young maternal age ({inputs.age})")

    if inputs.unexplained_prenatal_loss:
        score += 12
        reasons.append("Unexplained prenatal loss")
    if inputs.previous_complications:
        score += 10
        reasons.append("Previous pregnancy complications")

    if inputs.bmi is not None:
        if inputs.bmi < 18.5:
            score += 8
            reasons.append(f"Underweight (BMI {inputs.bmi:.1f})")
        elif inputs.bmi > 35:
            score += 8
            reasons.append(f"Obesity (BMI {inputs.bmi:.1f})")

    if inputs.smoking:
        score += 22
        reasons.append("Smoking")
    if inputs.alcohol:
        score += 20
        reasons.append("Alcohol use")

    if inputs.bp_systolic is not None and inputs.bp_systolic >= 140:
        score += 15
        reasons.append("Hypertension")
    if inputs.hemoglobin is not None and 0 < inputs.hemoglobin < 10:
        score += 12
        reasons.append(f"Anaemia (Hb {inputs.hemoglobin:.1f} g/dL)")
    if inputs.stress_level >= 3:
        score += 10
        reasons.append("Severe stress")
    if inputs.family_history:
        score += 5
        reasons.append("Family history")

    return _build("miscarriage", score, reasons)


def detect_mental_health(inputs: ScreeningInput) -> ConditionRisk:
    """Perinatal mental health risk from EPDS, PHQ-9 and psychosocial load."""
    score = 0.0
    reasons: List[str] = []

    score += inputs.stress_level * 8
    if inputs.stress_level >= 2:
        reasons.append(f"Moderate to severe stress (level {inputs.stress_level}/3)")

    score += inputs.sleep_disturbance * 6
    if inputs.sleep_disturbance >= 2:
        reasons.append(
            f"Significant sleep disturbance (level {inputs.sleep_disturbance}/3)"
        )

    if inputs.edinburgh_score > 13:
        score += 20
        reasons.append(f"EPDS {inputs.edinburgh_score}/30 — probable depression")
    elif inputs.edinburgh_score > 9:
        score += 10
        reasons.append(f"EPDS {inputs.edinburgh_score}/30 — borderline")

    if inputs.phq9_score > 15:
        score += 15
        reasons.append(f"PHQ-9 {inputs.phq9_score}/27 — severe")
    elif inputs.phq9_score > 10:
        score += 8
        reasons.append(f"PHQ-9 {inputs.phq9_score}/27 — moderate")

    score += inputs.mood_symptoms * 3
    if inputs.mood_symptoms >= 5:
        reasons.append(f"Significant mood symptoms ({inputs.mood_symptoms}/7)")

    if inputs.social_support <= 2:
        score += 10
        reasons.append(f"Low social support ({inputs.social_support}/5)")

    if inputs.history_depression:
        score += 8
        reasons.append("History of depression")

    return _build("mental_health", score, reasons)


def detect_pregnancy_risk(inputs: ScreeningInput) -> ConditionRisk:
    """Overall pregnancy risk from the same drivers the ML model uses.

    This is the rule-based baseline: the trained XGBoost model
    (`ml/detectors.py`) replaces it when its artifacts are available, and it is
    the fallback the ML detector defers to when haemoglobin or blood pressure is
    missing. Risk emerges from anaemia severity, blood pressure, maternal age
    and BMI together.
    """
    score = 0.0
    reasons: List[str] = []

    hb = inputs.hemoglobin
    if hb is not None and hb > 0:
        if hb < 7:
            score += 40
            reasons.append(f"Severe anaemia (Hb {hb:.1f} g/dL)")
        elif hb < 10:
            score += 30
            reasons.append(f"Moderate anaemia (Hb {hb:.1f} g/dL)")
        elif hb < 11:
            score += 18
            reasons.append(f"Mild anaemia (Hb {hb:.1f} g/dL)")

    sys_bp, dia_bp = _blood_pressure(inputs)
    if sys_bp is not None and dia_bp is not None:
        if sys_bp >= 160 or dia_bp >= 110:
            score += 30
            reasons.append(f"Severe hypertension ({sys_bp}/{dia_bp})")
        elif sys_bp >= 140 or dia_bp >= 90:
            score += 20
            reasons.append(f"Hypertension ({sys_bp}/{dia_bp})")
        elif sys_bp >= 130 or dia_bp >= 85:
            score += 10
            reasons.append(f"Elevated blood pressure ({sys_bp}/{dia_bp})")

    if inputs.age >= 40:
        score += 15
        reasons.append(f"Advanced maternal age ({inputs.age})")
    elif inputs.age >= 35:
        score += 8
        reasons.append(f"Maternal age {inputs.age}")
    elif inputs.age < 18:
        score += 12
        reasons.append(f"Young maternal age ({inputs.age})")

    bmi = inputs.bmi
    if bmi is not None:
        if bmi >= 35:
            score += 15
            reasons.append(f"Obesity (BMI {bmi:.1f})")
        elif bmi >= 30:
            score += 8
            reasons.append(f"High BMI ({bmi:.1f})")
        elif bmi < 18.5:
            score += 8
            reasons.append(f"Low BMI ({bmi:.1f})")

    if inputs.previous_complications:
        score += 10
        reasons.append("Previous pregnancy complications")

    return _build("pregnancy_risk", score, reasons)


#: Condition key -> baseline detector, in the order results are returned.
BASELINE_DETECTORS = {
    "anaemia": detect_anaemia,
    "pregnancy_risk": detect_pregnancy_risk,
    "gdm": detect_gdm,
    "preeclampsia": detect_preeclampsia,
    "uti": detect_uti,
    "thyroid": detect_thyroid,
    "miscarriage": detect_miscarriage,
    "mental_health": detect_mental_health,
}
