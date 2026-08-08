"""Load the maternal models and score a `ScreeningInput`.

The two XGBoost estimators and their feature schema are loaded once and cached.
`predict_from_screening` maps a pipeline `ScreeningInput` onto the exact feature
transform used at training time (`featurize.build_features`) and returns both
model outputs with confidences.
"""
import json
import os
from dataclasses import dataclass
from typing import Optional

import pandas as pd

from ..schemas import ScreeningInput
from .featurize import align_features, build_features

HERE = os.path.dirname(os.path.abspath(__file__))
ANEMIA_MODEL_PATH = os.path.join(HERE, "anemia_status_xgb.json")
RISK_MODEL_PATH = os.path.join(HERE, "pregnancy_risk_xgb.json")
SCHEMA_PATH = os.path.join(HERE, "model_schema.json")

_STATE: dict = {}


@dataclass
class MaternalPrediction:
    """Both model outputs for one patient."""

    anemia_status: str
    anemia_confidence: float
    pregnancy_risk: str
    risk_confidence: float


def _load() -> dict:
    """Load models + schema once; cached in module state."""
    if _STATE:
        return _STATE

    for path in (ANEMIA_MODEL_PATH, RISK_MODEL_PATH, SCHEMA_PATH):
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Maternal model artifact missing: {path}. Run "
                "`python -m disease_detection.ml.train_maternal_models`."
            )

    from xgboost import XGBClassifier  # imported here so the package stays light

    anemia_model = XGBClassifier()
    anemia_model.load_model(ANEMIA_MODEL_PATH)
    risk_model = XGBClassifier()
    risk_model.load_model(RISK_MODEL_PATH)

    with open(SCHEMA_PATH) as f:
        schema = json.load(f)

    _STATE.update(
        anemia_model=anemia_model,
        risk_model=risk_model,
        schema=schema,
    )
    return _STATE


def warm_up() -> None:
    """Force the models to load now (raises if artifacts are missing)."""
    _load()


def _raw_record(inputs: ScreeningInput) -> dict:
    """Turn a `ScreeningInput` into the raw columns `build_features` expects."""
    if inputs.bp_systolic is not None and inputs.bp_diastolic is not None:
        blood_pressure = f"{inputs.bp_systolic}/{inputs.bp_diastolic}"
    else:
        blood_pressure = ""
    return {
        "Age": inputs.age,
        "Gestational_Week": inputs.gestational_week,
        "Hemoglobin_g_dL": inputs.hemoglobin,
        "Iron_Supplement": "Yes" if inputs.iron_supplement else "No",
        "Blood_Pressure": blood_pressure,
        "BMI": inputs.bmi,
    }


def predict_from_screening(inputs: ScreeningInput) -> MaternalPrediction:
    """Run both models for one screening input."""
    state = _load()
    schema = state["schema"]

    raw = pd.DataFrame([_raw_record(inputs)])
    X = align_features(
        build_features(raw), schema["feature_columns"], schema["feature_defaults"]
    )

    anemia_model = state["anemia_model"]
    risk_model = state["risk_model"]
    a_labels = schema["anemia_labels"]
    r_labels = schema["risk_labels"]

    a_proba = anemia_model.predict_proba(X)[0]
    r_proba = risk_model.predict_proba(X)[0]
    a_idx = int(a_proba.argmax())
    r_idx = int(r_proba.argmax())

    return MaternalPrediction(
        anemia_status=a_labels[a_idx],
        anemia_confidence=round(float(a_proba[a_idx]), 3),
        pregnancy_risk=r_labels[r_idx],
        risk_confidence=round(float(r_proba[r_idx]), 3),
    )
