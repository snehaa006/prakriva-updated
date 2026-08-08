"""Train and save the maternal anemia + pregnancy-risk models.

Reproduces the two XGBoost estimators from the model notebook and writes three
artifacts next to this script:

    anemia_status_xgb.json   - Anemia Status classifier (Normal/Mild/Moderate/Severe)
    pregnancy_risk_xgb.json  - Pregnancy Risk classifier (Low/Medium/High)
    model_schema.json        - feature columns, per-feature defaults, label spaces

Models are saved with XGBoost's native JSON format (not pickle) so they load
cleanly across XGBoost versions — no version pin has to match the training env.

Usage (from the backend/ directory)::

    python -m disease_detection.ml.train_maternal_models

Re-run this whenever the dataset or feature set changes.
"""
import json
import os

import pandas as pd
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

from .featurize import (
    ANEMIA_LABELS,
    ANEMIA_MAP,
    FEATURE_COLUMNS,
    RISK_LABELS,
    RISK_MAP,
    align_features,
    build_features,
)

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(os.path.dirname(HERE))
DATA_PATH = os.path.join(BACKEND_DIR, "data", "maternal_anemia_dataset.csv")

ANEMIA_MODEL_PATH = os.path.join(HERE, "anemia_status_xgb.json")
RISK_MODEL_PATH = os.path.join(HERE, "pregnancy_risk_xgb.json")
SCHEMA_PATH = os.path.join(HERE, "model_schema.json")

RANDOM_STATE, TEST_SIZE = 42, 0.20
XGB_PARAMS = dict(
    n_estimators=350,
    max_depth=4,
    learning_rate=0.05,
    subsample=0.9,
    colsample_bytree=0.9,
    eval_metric="mlogloss",
    random_state=RANDOM_STATE,
)


def train(data_path: str = DATA_PATH) -> dict:
    df_raw = pd.read_csv(data_path)
    print(f"[INFO] Loaded {len(df_raw)} rows from {data_path}")

    X_full = build_features(df_raw)
    feature_defaults = {c: float(X_full[c].median()) for c in FEATURE_COLUMNS}
    X = align_features(X_full, FEATURE_COLUMNS, feature_defaults)

    y_anemia = df_raw["Anemia_Status"].map(ANEMIA_MAP)
    y_risk = df_raw["Pregnancy_Risk"].map(RISK_MAP)

    idx_tr, idx_te = train_test_split(
        X.index, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y_risk
    )

    anemia_model = XGBClassifier(**XGB_PARAMS)
    anemia_model.fit(X.loc[idx_tr], y_anemia.loc[idx_tr])

    risk_model = XGBClassifier(**XGB_PARAMS)
    risk_model.fit(X.loc[idx_tr], y_risk.loc[idx_tr])

    a_acc = accuracy_score(y_anemia.loc[idx_te], anemia_model.predict(X.loc[idx_te]))
    r_acc = accuracy_score(y_risk.loc[idx_te], risk_model.predict(X.loc[idx_te]))
    r_f1 = f1_score(
        y_risk.loc[idx_te], risk_model.predict(X.loc[idx_te]), average="weighted"
    )
    print(f"[EVAL] Anemia test accuracy      : {a_acc:.4f}")
    print(f"[EVAL] Pregnancy-risk test acc.  : {r_acc:.4f}")
    print(f"[EVAL] Pregnancy-risk weighted F1: {r_f1:.4f}")

    anemia_model.save_model(ANEMIA_MODEL_PATH)
    risk_model.save_model(RISK_MODEL_PATH)
    with open(SCHEMA_PATH, "w") as f:
        json.dump(
            {
                "feature_columns": FEATURE_COLUMNS,
                "feature_defaults": feature_defaults,
                "anemia_labels": ANEMIA_LABELS,
                "risk_labels": RISK_LABELS,
            },
            f,
            indent=2,
        )
    print(f"[SUCCESS] Saved:\n  {ANEMIA_MODEL_PATH}\n  {RISK_MODEL_PATH}\n  {SCHEMA_PATH}")
    return {"anemia_accuracy": a_acc, "risk_accuracy": r_acc, "risk_f1": r_f1}


if __name__ == "__main__":
    train()
