"""Load the maternal models and score a `ScreeningInput`.

The two XGBoost estimators and their feature schema are loaded once and cached.
`predict_from_screening` maps a pipeline `ScreeningInput` onto the exact feature
transform used at training time (`featurize.build_features`) and returns both
model outputs with confidences.
"""
import json
import os
from dataclasses import dataclass
from typing import List, Optional

import numpy as np
import pandas as pd

from ..schemas import ScreeningInput
from .featurize import align_features, build_features
from .gdm_featurize import risk_level_for

HERE = os.path.dirname(os.path.abspath(__file__))
ANEMIA_MODEL_PATH = os.path.join(HERE, "anemia_status_xgb.json")
RISK_MODEL_PATH = os.path.join(HERE, "pregnancy_risk_xgb.json")
SCHEMA_PATH = os.path.join(HERE, "model_schema.json")
GDM_MODEL_PATH = os.path.join(HERE, "gdm_model.json")

_STATE: dict = {}
_GDM_STATE: dict = {}


@dataclass
class MaternalPrediction:
    """Both model outputs for one patient."""

    anemia_status: str
    anemia_confidence: float
    pregnancy_risk: str
    risk_confidence: float


@dataclass
class GdmPrediction:
    """GDM early-screening output for one patient."""

    probability: float
    risk_level: str
    #: Features the patient had no value for, filled with the training median.
    imputed_features: List[str]


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


def _load_gdm() -> dict:
    """Load the GDM coefficients/scaler once; cached in module state."""
    if _GDM_STATE:
        return _GDM_STATE

    if not os.path.exists(GDM_MODEL_PATH):
        raise FileNotFoundError(
            f"GDM model artifact missing: {GDM_MODEL_PATH}. Run "
            "`python -m disease_detection.ml.train_gdm_model`."
        )

    with open(GDM_MODEL_PATH) as f:
        artifact = json.load(f)

    _GDM_STATE.update(
        feature_columns=artifact["feature_columns"],
        mean=np.array(artifact["scaler_mean"], dtype=float),
        scale=np.array(artifact["scaler_scale"], dtype=float),
        coefficients=np.array(artifact["coefficients"], dtype=float),
        intercept=float(artifact["intercept"]),
        medians=artifact["feature_medians"],
    )
    return _GDM_STATE


def warm_up() -> None:
    """Force the models to load now (raises if artifacts are missing)."""
    _load()
    _load_gdm()


def _gdm_raw_values(inputs: ScreeningInput) -> dict:
    """Map a `ScreeningInput` onto the GDM model's raw feature values.

    Twelve of the fifteen features are already collected elsewhere in the app,
    so they are read straight off the screening input. `None` marks a value the
    patient does not have; `predict_gdm` fills those with the training median.
    """
    return {
        "age": inputs.age,
        "bmi": inputs.bmi,
        "systolic_bp": inputs.bp_systolic,
        "diastolic_bp": inputs.bp_diastolic,
        "no_of_pregnancies": inputs.gravida,
        "prior_gdm": int(inputs.gestational_diabetes_previous),
        "family_history_diabetes": int(inputs.family_history),
        "prior_unexplained_loss": int(inputs.unexplained_prenatal_loss),
        "prior_macrosomia": int(inputs.large_baby_previous),
        "pcos_diagnosed": int(inputs.pcos),
        "known_prediabetes": int(inputs.known_prediabetes),
        "sedentary_lifestyle": int(inputs.sedentary_lifestyle),
        "hba1c_pct": inputs.hba1c,
        "hdl_mgdL": inputs.hdl,
        "triglycerides_mgdL": inputs.triglycerides,
    }


def predict_gdm(inputs: ScreeningInput) -> GdmPrediction:
    """GDM probability for one screening input.

    Evaluates the logistic regression directly from its stored coefficients
    (standardise, dot product, sigmoid) rather than through scikit-learn, so
    predictions do not depend on the installed scikit-learn version. The
    training script asserts this reproduces `predict_proba` exactly.
    """
    state = _load_gdm()
    columns = state["feature_columns"]
    medians = state["medians"]

    raw = _gdm_raw_values(inputs)
    imputed: List[str] = []
    values = []
    for column in columns:
        value = raw.get(column)
        if value is None:
            value = medians[column]
            imputed.append(column)
        values.append(float(value))

    x = np.array(values, dtype=float)
    scaled = (x - state["mean"]) / state["scale"]
    logit = float(scaled @ state["coefficients"] + state["intercept"])
    probability = 1.0 / (1.0 + np.exp(-logit))

    return GdmPrediction(
        probability=round(probability, 4),
        risk_level=risk_level_for(probability),
        imputed_features=imputed,
    )


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
