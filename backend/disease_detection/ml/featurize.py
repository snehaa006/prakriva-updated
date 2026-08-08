"""Shared feature transform for the maternal anemia / pregnancy-risk models.

This is the *single* preprocessing path used by both training
(`train_maternal_models.py`) and dashboard inference (`inference.py`), so the
models can never drift from what the screening form sends. It is ported
verbatim from the model notebook's helper functions.

Raw inputs accepted (either CSV columns or a dashboard record):

    Age, Gestational_Week, Hemoglobin_g_dL, Iron_Supplement ('Yes'/'No'),
    Blood_Pressure ('118/76'), and either BMI OR (Weight_kg + Height).

`build_features` turns those into the nine numeric columns the models expect.
"""
import re

import numpy as np
import pandas as pd

#: Model input columns, in the exact order the estimators were trained on.
FEATURE_COLUMNS = [
    "Age", "Gestational_Week", "Hemoglobin_g_dL", "Iron_Supplement",
    "Systolic_BP", "Diastolic_BP", "MAP", "Pulse_Pressure", "BMI",
]

#: Output label spaces (index == class id the models emit).
ANEMIA_LABELS = ["Normal", "Mild", "Moderate", "Severe"]  # 0,1,2,3
RISK_LABELS = ["Low", "Medium", "High"]                   # 0,1,2
ANEMIA_MAP = {k: i for i, k in enumerate(ANEMIA_LABELS)}
RISK_MAP = {k: i for i, k in enumerate(RISK_LABELS)}


def _num(series: pd.Series) -> pd.Series:
    """First number found in each cell, as a float (NaN when none)."""
    return pd.to_numeric(
        series.astype(str).str.extract(r"(\d+\.?\d*)")[0], errors="coerce"
    )


def _parse_bp(series: pd.Series):
    """Split '118/76' style blood pressure into (systolic, diastolic)."""
    parts = series.astype(str).str.extract(r"(?P<sys>\d+)\s*/\s*(?P<dia>\d+)")
    return (
        pd.to_numeric(parts["sys"], errors="coerce"),
        pd.to_numeric(parts["dia"], errors="coerce"),
    )


def _height_cm(value) -> float:
    """Height to centimetres, accepting cm or feet.inches (5.2 -> 5ft 2in)."""
    if pd.isna(value):
        return np.nan
    match = re.search(r"(\d+\.?\d*)", str(value))
    if not match:
        return np.nan
    v = float(match.group(1))
    if v < 8.0:  # feet.inches
        feet = int(v)
        inches = round((v - feet) * 10)
        return (feet * 12 + inches) * 2.54
    return v  # already cm


def preprocess(df: pd.DataFrame) -> pd.DataFrame:
    """Raw dashboard/CSV columns -> clean numeric feature columns."""
    out = pd.DataFrame(index=df.index)
    out["Age"] = _num(df["Age"])
    out["Gestational_Week"] = _num(df["Gestational_Week"])
    out["Hemoglobin_g_dL"] = _num(df["Hemoglobin_g_dL"])
    out["Iron_Supplement"] = (
        df["Iron_Supplement"].astype(str).str.strip().str.lower().eq("yes").astype(int)
    )
    sys_bp, dia_bp = _parse_bp(df["Blood_Pressure"])
    out["Systolic_BP"] = sys_bp
    out["Diastolic_BP"] = dia_bp
    # BMI: use it directly if present (NaN cells are filled with the training
    # default later), else compute from weight + height.
    if "BMI" in df.columns:
        out["BMI"] = _num(df["BMI"])
    else:
        w = _num(df["Weight_kg"])
        h = (
            df["Height"].apply(_height_cm)
            if "Height" in df.columns
            else _num(df["Height_cm"])
        )
        out["BMI"] = w / ((h / 100.0) ** 2)
    return out


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add the two derived blood-pressure features."""
    out = df.copy()
    out["MAP"] = out["Diastolic_BP"] + (1.0 / 3.0) * (
        out["Systolic_BP"] - out["Diastolic_BP"]
    )
    out["Pulse_Pressure"] = out["Systolic_BP"] - out["Diastolic_BP"]
    return out


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    return engineer_features(preprocess(df))


def align_features(X: pd.DataFrame, cols, defaults) -> pd.DataFrame:
    """Reindex to `cols`, filling missing/NaN cells with per-column defaults."""
    X = X.copy()
    for c in cols:
        d = defaults.get(c, 0.0)
        if c not in X.columns:
            X[c] = d
        X[c] = X[c].fillna(d)
    return X[cols]
