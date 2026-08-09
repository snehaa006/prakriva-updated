"""Convert the trained preeclampsia pipeline into a portable artifact.

The model arrived as a pickled scikit-learn Pipeline
(`backend/data/preeclampsia_source/`). This folds its preprocessing statistics
and logistic-regression coefficients into one JSON file next to this module:

    preeclampsia_model.json

Why convert
-----------
Same reason as the GDM and thyroid models: the pickle was written with
scikit-learn 1.6.1, and this repo pins 1.7.2. Loading a pickle across versions
risks silently wrong predictions — and this one does not even load cleanly,
since `_RemainderColsList` was removed in 1.7 (hence the shim below). A logistic
regression over a median-impute-and-standardise front end is fully described by
plain numbers, so those are stored instead and inference runs in numpy.

Usage (from the backend/ directory)::

    python -m disease_detection.ml.convert_preeclampsia_model
"""
import json
import os

import numpy as np

from .preeclampsia_featurize import BINARY_FEATURES, CONTINUOUS_FEATURES

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_DIR = os.path.join(BACKEND_DIR, "data", "preeclampsia_source")

PIPELINE_PATH = os.path.join(SOURCE_DIR, "preeclampsia_model.pkl")
FEATURE_ORDER_PATH = os.path.join(SOURCE_DIR, "raw_feature_order.pkl")
MODEL_OUT = os.path.join(HERE, "preeclampsia_model.json")


def _install_sklearn_shim() -> None:
    """Make the 1.6.1 pickle loadable under 1.7.x (see module docstring)."""
    import sklearn.compose._column_transformer as ct

    if not hasattr(ct, "_RemainderColsList"):
        class _RemainderColsList(list):
            pass

        ct._RemainderColsList = _RemainderColsList


def _repair_imputers(pipeline) -> None:
    """Restore the attribute newer scikit-learn expects on unpickled imputers.

    1.6 stored `_fit_dtype`; later versions read `_fill_dtype`. Without this the
    unpickled SimpleImputer loads but raises the moment it transforms — which is
    exactly the "loads fine, breaks later" failure mode that makes shipping this
    pickle a bad idea in the first place. Only needed for the verification pass
    below; the deployed backend reads the extracted JSON and never unpickles.
    """
    from sklearn.impute import SimpleImputer

    for _, transformer, _ in pipeline.named_steps["preprocess"].transformers_:
        steps = getattr(transformer, "named_steps", {"impute": transformer})
        for step in steps.values():
            if isinstance(step, SimpleImputer) and not hasattr(step, "_fill_dtype"):
                step._fill_dtype = getattr(step, "_fit_dtype", np.dtype("float64"))


def convert() -> None:
    _install_sklearn_shim()
    import joblib

    pipeline = joblib.load(PIPELINE_PATH)
    _repair_imputers(pipeline)
    pre = pipeline.named_steps["preprocess"]
    clf = pipeline.named_steps["clf"]

    blocks = {name: (trans, list(cols)) for name, trans, cols in pre.transformers_}
    cont_trans, cont_cols = blocks["cont"]
    bin_trans, bin_cols = blocks["bin"]

    if cont_cols != CONTINUOUS_FEATURES or bin_cols != BINARY_FEATURES:
        raise ValueError(
            "preeclampsia_featurize feature lists do not match the saved pipeline"
        )

    artifact = {
        "continuous_features": cont_cols,
        "binary_features": bin_cols,
        "continuous_medians": [
            float(v) for v in cont_trans.named_steps["impute"].statistics_
        ],
        "scaler_mean": [float(v) for v in cont_trans.named_steps["scale"].mean_],
        "scaler_scale": [float(v) for v in cont_trans.named_steps["scale"].scale_],
        "binary_most_frequent": [float(v) for v in bin_trans.statistics_],
        "coefficients": [float(v) for v in clf.coef_[0]],
        "intercept": float(clf.intercept_[0]),
        "raw_feature_order": list(joblib.load(FEATURE_ORDER_PATH)),
    }

    print(f"[INFO] Features: {len(cont_cols)} continuous + {len(bin_cols)} binary")

    # Prove the numpy path reproduces the pipeline before writing anything.
    import pandas as pd

    rng = np.random.default_rng(0)
    probe = pd.DataFrame(
        {
            col: rng.uniform(0, 40, 64)
            for col in artifact["raw_feature_order"]
        }
    )
    expected = pipeline.predict_proba(probe)[:, 1]

    mean = np.array(artifact["scaler_mean"])
    scale = np.array(artifact["scaler_scale"])
    coef = np.array(artifact["coefficients"])
    scaled = (probe[cont_cols].to_numpy(dtype=float) - mean) / scale
    x = np.hstack([scaled, probe[bin_cols].to_numpy(dtype=float)])
    actual = 1.0 / (1.0 + np.exp(-(x @ coef + artifact["intercept"])))

    drift = float(np.abs(expected - actual).max())
    print(f"[CHECK] Max drift vs the sklearn pipeline: {drift:.2e}")
    if drift > 1e-9:
        raise AssertionError(f"numpy path does not reproduce the pipeline ({drift:.2e})")

    with open(MODEL_OUT, "w") as f:
        json.dump(artifact, f, indent=2)
    print(f"[SUCCESS] Saved: {MODEL_OUT}")


if __name__ == "__main__":
    convert()
