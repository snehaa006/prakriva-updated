"""Clinical next steps per condition and risk level.

Ported from the Neuviaa analytics prototype so the wording a doctor sees in
Prakriva matches what the Neuviaa screening produced.
"""
from typing import Dict, List

from .schemas import RiskLevel

#: Advice added only at the given risk level, most urgent first.
_ESCALATION: Dict[str, Dict[RiskLevel, List[str]]] = {
    "uti": {
        RiskLevel.HIGH: [
            "URGENT: refer for urine culture and antibiotic treatment — untreated "
            "UTI in pregnancy can progress to pyelonephritis and preterm labour",
        ],
        RiskLevel.MODERATE: [
            "Order urine analysis and review symptoms within 48 hours",
        ],
    },
    "thyroid": {
        RiskLevel.HIGH: [
            "URGENT: endocrinology referral — untreated thyroid disease affects "
            "fetal neurodevelopment",
            "Request a full panel: TSH, free T3, free T4, TPO antibodies",
        ],
        RiskLevel.MODERATE: [
            "Order a thyroid panel (TSH, T3, T4) and re-check in 2 weeks",
        ],
    },
    "mental_health": {
        RiskLevel.HIGH: [
            "CRITICAL: same-day perinatal mental health referral; screen for "
            "self-harm risk",
            "Involve the patient's support system with her consent",
        ],
        RiskLevel.MODERATE: [
            "Refer to a perinatal mental health specialist for assessment",
        ],
    },
    "miscarriage": {
        RiskLevel.HIGH: [
            "URGENT: maternal-fetal medicine review for high-risk pregnancy "
            "management",
            "Arrange early ultrasound monitoring and hormone level checks",
        ],
        RiskLevel.MODERATE: [
            "Flag risk factors for closer antenatal monitoring",
        ],
    },
    "anaemia": {
        RiskLevel.HIGH: [
            "URGENT: start iron supplementation and repeat haemoglobin testing; "
            "severe anaemia may need IV iron or transfusion",
        ],
        RiskLevel.MODERATE: [
            "Start oral iron supplements and recheck haemoglobin in 4 weeks",
        ],
    },
    "pregnancy_risk": {
        RiskLevel.HIGH: [
            "URGENT: refer for obstetric review and closer antenatal monitoring — "
            "multiple risk factors are present",
            "Address the driving factors directly (anaemia, blood pressure, weight)",
        ],
        RiskLevel.MODERATE: [
            "Increase antenatal visit frequency and monitor the contributing factors",
        ],
    },
    "preeclampsia": {
        RiskLevel.HIGH: [
            "CRITICAL: immediate obstetric evaluation — possible admission",
            "Watch for severe headache, visual changes and upper abdominal pain",
        ],
        RiskLevel.MODERATE: [
            "Increase antenatal visit frequency for blood pressure monitoring",
            "Repeat urine protein and blood work",
        ],
    },
    "gdm": {
        RiskLevel.HIGH: [
            "URGENT: glucose tolerance test and endocrinology consultation",
        ],
        RiskLevel.MODERATE: [
            "Order glucose screening at the next visit",
        ],
    },
}

#: Advice given at every risk level, including low.
_BASELINE: Dict[str, List[str]] = {
    "uti": [
        "Increase water intake to 8-10 glasses per day",
        "Avoid holding urine; void frequently and after intercourse",
        "Reinforce front-to-back hygiene",
    ],
    "thyroid": [
        "Ensure adequate iodine intake (iodised salt, dairy, fish)",
        "Prenatal vitamins containing selenium and zinc",
        "Recheck thyroid function each trimester",
    ],
    "mental_health": [
        "Structured stress reduction: prenatal yoga, breathing, meditation",
        "Protect sleep — consistent schedule and rest periods",
        "Strengthen social support; avoid isolation",
        "Consider CBT or counselling referral",
    ],
    "miscarriage": [
        "Prenatal vitamins with folic acid daily",
        "Avoid smoking, alcohol and recreational drugs entirely",
        "Limit caffeine to under 200 mg per day",
        "Adequate rest; avoid strenuous activity",
    ],
    "anaemia": [
        "Iron-rich diet: leafy greens, lentils, red meat, fortified cereals",
        "Take iron with vitamin C; avoid tea/coffee with meals",
        "Include folate-rich foods: beans, citrus, dark greens",
        "Monitor haemoglobin through the pregnancy",
    ],
    "pregnancy_risk": [
        "Keep every scheduled antenatal appointment",
        "Maintain a balanced, iron- and folate-rich diet and stay hydrated",
        "Track blood pressure and report headaches, swelling or reduced fetal movement",
        "Take prescribed supplements (iron, folic acid) consistently",
    ],
    "preeclampsia": [
        "Home blood pressure monitoring where possible",
        "Reduce sodium intake; watch for sudden swelling or weight gain",
        "Rest with legs elevated; stay hydrated",
    ],
    "gdm": [
        "Low-glycaemic diet: complex carbohydrates and fibre, small frequent meals",
        "30 minutes of moderate activity daily if cleared by the obstetrician",
        "Avoid sugary drinks and processed foods",
        "Monitor fetal growth for macrosomia",
    ],
}


def get_recommendations(condition: str, risk_level: RiskLevel) -> List[str]:
    """Next steps for `condition` at `risk_level`, escalation advice first."""
    escalation = _ESCALATION.get(condition, {}).get(risk_level, [])
    return [*escalation, *_BASELINE.get(condition, [])]
