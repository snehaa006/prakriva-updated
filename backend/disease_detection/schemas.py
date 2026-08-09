"""Request/response models for the maternal disease detection pipeline.

The input vocabulary mirrors the Neuviaa analytics prototype, normalised to
snake_case and validated so a detector can rely on the ranges instead of
re-checking them.
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class RiskLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


class TernaryEnum(str, Enum):
    """Lab results that can legitimately be unknown (test not performed)."""

    POSITIVE = "positive"
    NEGATIVE = "negative"
    UNKNOWN = "unknown"


class TrimesterEnum(str, Enum):
    FIRST = "first"
    SECOND = "second"
    THIRD = "third"
    UNKNOWN = "unknown"


#: Condition keys the pipeline screens for, with display labels for the UI.
CONDITIONS: Dict[str, str] = {
    "anaemia": "Anaemia",
    "pregnancy_risk": "Pregnancy Risk",
    "gdm": "Gestational Diabetes",
    "preeclampsia": "Preeclampsia",
    "uti": "Urinary Tract Infection",
    "thyroid": "Thyroid Disorder",
    "miscarriage": "Miscarriage Risk",
    "mental_health": "Perinatal Mental Health",
}

#: Symptom vocabulary accepted in `ScreeningInput.symptoms`.
SYMPTOMS: Dict[str, str] = {
    "fatigue": "Fatigue",
    "dizziness": "Dizziness / lightheadedness",
    "painful_urination": "Painful or burning urination",
    "frequent_urination": "Frequent urination",
    "lower_abdominal_pain": "Lower abdominal pain",
    "back_pain": "Back pain",
    "fever": "Fever",
    "blurred_vision": "Blurred vision",
    "palpitations": "Palpitations",
    "shortness_of_breath": "Shortness of breath",
    "headache": "Headache",
    "cold_hands_feet": "Cold hands / feet",
    "swelling": "Swelling (oedema)",
    "pale_skin": "Pale skin",
    "cloudy_urine": "Cloudy or foul-smelling urine",
    "blood_in_urine": "Blood in urine",
    "bleeding": "Vaginal bleeding",
    "cramping": "Cramping",
}


class ScreeningInput(BaseModel):
    """Everything the detectors may read.

    Every clinical field is optional: a screening run with only the
    questionnaire data the patient already filled in is valid, and each detector
    scores on what it was given. Labs left as `None` are treated as "not
    performed" rather than normal.
    """

    # --- Basic information -------------------------------------------------
    age: int = Field(..., ge=10, le=60, description="Maternal age in years")
    trimester: TrimesterEnum = TrimesterEnum.UNKNOWN
    gestational_week: Optional[int] = Field(
        None, ge=0, le=45, description="Weeks of gestation"
    )
    bmi: Optional[float] = Field(None, ge=10, le=60)
    iron_supplement: bool = Field(
        False, description="Currently taking iron supplements"
    )
    gravida: int = Field(0, ge=0, le=20, description="Number of pregnancies")
    parity: int = Field(0, ge=0, le=20, description="Number of births")
    bp_systolic: Optional[int] = Field(None, ge=60, le=300)
    bp_diastolic: Optional[int] = Field(None, ge=30, le=200)

    # --- History / risk factors -------------------------------------------
    family_history: bool = False
    pcos: bool = False
    previous_miscarriage: bool = False
    sedentary_lifestyle: bool = False
    anaemia_history: bool = False
    previous_complications: bool = False
    previous_uti: bool = False
    gestational_diabetes_previous: bool = False
    known_prediabetes: bool = Field(
        False, description="Previously told she has prediabetes"
    )
    unexplained_prenatal_loss: bool = False
    large_baby_previous: bool = False
    history_depression: bool = False
    smoking: bool = False
    alcohol: bool = False

    # --- Symptoms / signs --------------------------------------------------
    symptoms: List[str] = Field(default_factory=list)
    weight_gain: bool = Field(False, description="Unexplained weight gain")
    hair_loss: bool = False
    cold_intolerance: bool = False
    constipation: bool = False
    menstrual_irregularity: bool = Field(
        False, description="Menstrual irregularity before pregnancy"
    )
    excessive_thirst: bool = False
    proteinuria: TernaryEnum = TernaryEnum.UNKNOWN

    # --- Mental health scales ---------------------------------------------
    stress_level: int = Field(0, ge=0, le=3)
    sleep_disturbance: int = Field(0, ge=0, le=3)
    mood_symptoms: int = Field(0, ge=0, le=7)
    social_support: int = Field(3, ge=0, le=5)
    edinburgh_score: int = Field(0, ge=0, le=30, description="EPDS, 0-30")
    phq9_score: int = Field(0, ge=0, le=27, description="PHQ-9, 0-27")

    # --- Optional laboratory values ---------------------------------------
    hemoglobin: Optional[float] = Field(None, ge=0, le=25, description="g/dL")
    hba1c: Optional[float] = Field(None, ge=0, le=20, description="%")
    ogtt_1hr: Optional[float] = Field(None, ge=0, le=500, description="mg/dL")
    # Lipids — used by the GDM early-screening model (ml/gdm_featurize.py).
    hdl: Optional[float] = Field(None, ge=0, le=200, description="HDL, mg/dL")
    triglycerides: Optional[float] = Field(
        None, ge=0, le=2000, description="Triglycerides, mg/dL"
    )
    urine_wbc: Optional[int] = Field(None, ge=0, le=5000)
    urine_nitrite: TernaryEnum = TernaryEnum.UNKNOWN
    tsh: Optional[float] = Field(None, ge=0, le=100, description="mIU/L")
    t3: Optional[float] = Field(None, ge=0, le=500)
    t4: Optional[float] = Field(None, ge=0, le=50)

    @field_validator("symptoms")
    @classmethod
    def validate_symptoms(cls, value: List[str]) -> List[str]:
        """Normalise and reject unknown symptom keys.

        A typo would otherwise silently drop a symptom out of the score, which
        is worse than a 400 on a screening the doctor is watching.
        """
        normalised = []
        for symptom in value:
            key = str(symptom).strip().lower().replace(" ", "_").replace("/", "_")
            if key not in SYMPTOMS:
                raise ValueError(
                    f"Unknown symptom '{symptom}'. Allowed: {', '.join(sorted(SYMPTOMS))}"
                )
            if key not in normalised:
                normalised.append(key)
        return normalised

    def has(self, symptom: str) -> bool:
        """True when `symptom` was reported."""
        return symptom in self.symptoms

    def has_any(self, *symptoms: str) -> bool:
        """True when any of `symptoms` was reported."""
        return any(s in self.symptoms for s in symptoms)

    @property
    def effective_bmi(self) -> Optional[float]:
        return self.bmi


class ConditionRisk(BaseModel):
    """One condition's verdict."""

    condition: str = Field(..., description="Condition key, e.g. 'anaemia'")
    label: str = Field(..., description="Human-readable condition name")
    score: float = Field(..., ge=0, le=100, description="Risk score, 0-100")
    risk_level: RiskLevel
    reasons: List[str] = Field(
        default_factory=list, description="Factors that drove the score"
    )
    recommendations: List[str] = Field(default_factory=list)
    detector: str = Field(
        "rules-v1", description="Which detector produced this result"
    )
    details: Dict[str, Any] = Field(
        default_factory=dict,
        description="Condition-specific extras, e.g. thyroid sub-type",
    )


class ScreeningResult(BaseModel):
    """The full screening run for one patient."""

    generated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    conditions: List[ConditionRisk] = Field(default_factory=list)
    overall_risk_level: RiskLevel = RiskLevel.LOW
    highest_risk_condition: Optional[str] = None
    disclaimer: str = (
        "Screening support only. These scores are decision aids for a "
        "clinician and are not a diagnosis."
    )
