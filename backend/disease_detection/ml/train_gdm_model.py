"""Train and save the gestational diabetes (GDM) early-screening model.

Reproduces the class-balanced logistic regression from the source notebook,
restricted to the 15 features documented in `gdm_featurize.py`, and writes one
artifact next to this script:

    gdm_model.json  - feature order, scaler mean/scale, coefficients, intercept
                      and per-feature medians used to impute missing labs

Why JSON rather than a pickle
-----------------------------
The notebook saved `gdm_logistic_regression_model.pkl` plus a separate
`gdm_scaler.pkl`. A logistic regression is fully described by its coefficients,
intercept and the scaler's mean/scale, so storing those as plain numbers means:

* no scikit-learn version coupling — the notebook's pickle was written with
  1.6.1 while this repo pins 1.7.2, and loading a pickle across versions risks
  silently wrong predictions (the same hazard `CLAUDE.md` flags for
  `dosha_model.pkl`);
* no unpickling of an opaque binary at import time;
* the scaler cannot go missing, because it travels in the same file as the
  coefficients it belongs to.

Usage (from the backend/ directory)::

    python -m disease_detection.ml.train_gdm_model

Re-run this whenever the dataset or feature set changes.
"""
import json
import os

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from .gdm_featurize import FEATURE_COLUMNS

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(os.path.dirname(HERE))
DATA_PATH = os.path.join(BACKEND_DIR, "data", "gdm_dataset.csv")
MODEL_PATH = os.path.join(HERE, "gdm_model.json")

TARGET = "gdm_status"
RANDOM_STATE, TEST_SIZE = 42, 0.20


def train(data_path: str = DATA_PATH) -> dict:
    df = pd.read_csv(data_path)
    print(f"[INFO] Loaded {len(df)} rows from {data_path}")

    X = df[FEATURE_COLUMNS]
    y = df[TARGET]
    print(f"[INFO] GDM prevalence: {y.mean() * 100:.1f}%")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # class_weight="balanced" matters: GDM prevalence is ~17%, and an unweighted
    # fit would trade away the recall that makes a screening model useful.
    model = LogisticRegression(
        class_weight="balanced", max_iter=1000, random_state=RANDOM_STATE
    )
    model.fit(X_train_scaled, y_train)

    proba = model.predict_proba(X_test_scaled)[:, 1]
    pred = model.predict(X_test_scaled)
    auc = roc_auc_score(y_test, proba)
    rec = recall_score(y_test, pred)
    prec = precision_score(y_test, pred)
    print(f"[EVAL] ROC-AUC            : {auc:.4f}")
    print(f"[EVAL] Recall (sensitivity): {rec:.4f}")
    print(f"[EVAL] Precision          : {prec:.4f}")

    # Medians come from the training split only, so nothing from the held-out
    # test set leaks into the values used to impute missing labs at inference.
    medians = {c: float(X_train[c].median()) for c in FEATURE_COLUMNS}

    artifact = {
        "feature_columns": FEATURE_COLUMNS,
        "scaler_mean": [float(v) for v in scaler.mean_],
        "scaler_scale": [float(v) for v in scaler.scale_],
        "coefficients": [float(v) for v in model.coef_[0]],
        "intercept": float(model.intercept_[0]),
        "feature_medians": medians,
        "metrics": {"roc_auc": auc, "recall": rec, "precision": prec},
    }
    with open(MODEL_PATH, "w") as f:
        json.dump(artifact, f, indent=2)
    print(f"[SUCCESS] Saved: {MODEL_PATH}")

    # Guard the hand-rolled sigmoid used at inference against sklearn's own
    # output, so a refactor there cannot silently change predictions.
    manual = 1.0 / (1.0 + np.exp(-(X_test_scaled @ model.coef_[0] + model.intercept_[0])))
    drift = float(np.abs(manual - proba).max())
    print(f"[CHECK] Max drift vs sklearn predict_proba: {drift:.2e}")
    assert drift < 1e-9, "Manual sigmoid does not reproduce sklearn's predict_proba"

    return artifact["metrics"]


if __name__ == "__main__":
    train()
