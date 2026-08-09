"""Convert the trained thyroid artifacts into portable, dependency-free ones.

The model was trained externally as a Keras neural network and exported as four
pieces (`backend/data/thyroid_source/`): the network weights, a scikit-learn
`ColumnTransformer` preprocessor, the raw feature order, and the decision
threshold. This script folds all of that into two files next to this module:

    thyroid_model.npz     - the network's weight matrices
    thyroid_schema.json   - feature order, imputation/scaling stats, threshold

Why convert at all
------------------
Shipping the originals would drag TensorFlow into the deployed backend. That is
roughly 600 MB installed and several hundred MB resident, against a 512 MB
free-tier Render instance — it would not merely be wasteful, it would very
likely take down the whole API, including the anaemia and GDM models that
already work.

None of that weight buys anything at inference. A trained feed-forward network
is just fixed arithmetic: dropout is a no-op outside training, batch
normalisation collapses to a fixed affine transform, and the rest is matrix
multiplications. `inference.py` does exactly that in numpy, which the repo
already depends on.

The preprocessor pickle has the same problem in a sharper form: it was written
with scikit-learn 1.6.1, and under the 1.7.2 this repo pins it does not merely
warn — it **fails to unpickle**, because `_RemainderColsList` no longer exists.
So its imputation medians, scaler statistics and most-frequent values are
extracted here into plain numbers instead.

Usage (from the backend/ directory, with tensorflow and scikit-learn 1.6-era
pickles readable — see the shim below)::

    python -m disease_detection.ml.convert_thyroid_model

Re-run this only when the upstream model is retrained.
"""
import json
import os

import numpy as np

from .thyroid_featurize import BINARY_FEATURES, CONTINUOUS_FEATURES

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_DIR = os.path.join(BACKEND_DIR, "data", "thyroid_source")

WEIGHTS_PATH = os.path.join(SOURCE_DIR, "model.weights.h5")
PREPROCESSOR_PATH = os.path.join(SOURCE_DIR, "preprocessor.pkl")
FEATURE_ORDER_PATH = os.path.join(SOURCE_DIR, "raw_feature_order.pkl")
THRESHOLD_PATH = os.path.join(SOURCE_DIR, "threshold.pkl")

MODEL_OUT = os.path.join(HERE, "thyroid_model.npz")
SCHEMA_OUT = os.path.join(HERE, "thyroid_schema.json")

#: Keras BatchNormalization default.
BN_EPSILON = 1e-3


def _install_sklearn_shim() -> None:
    """Make the scikit-learn 1.6.1 preprocessor pickle loadable under 1.7.x.

    1.7 removed `_RemainderColsList`. It only ever held the remainder column
    list, which this preprocessor drops, so a plain list subclass restores
    enough for the pickle to load.
    """
    import sklearn.compose._column_transformer as ct

    if not hasattr(ct, "_RemainderColsList"):
        class _RemainderColsList(list):
            pass

        ct._RemainderColsList = _RemainderColsList


def extract_preprocessor() -> dict:
    """Imputation and scaling statistics, as plain Python numbers."""
    _install_sklearn_shim()
    import joblib

    pre = joblib.load(PREPROCESSOR_PATH)
    blocks = {name: (trans, list(cols)) for name, trans, cols in pre.transformers_}

    cont_trans, cont_cols = blocks["cont"]
    bin_trans, bin_cols = blocks["bin"]

    if cont_cols != CONTINUOUS_FEATURES or bin_cols != BINARY_FEATURES:
        raise ValueError(
            "thyroid_featurize feature lists do not match the saved preprocessor"
        )

    return {
        "continuous_features": cont_cols,
        "binary_features": bin_cols,
        "continuous_medians": [
            float(v) for v in cont_trans.named_steps["impute"].statistics_
        ],
        "scaler_mean": [float(v) for v in cont_trans.named_steps["scale"].mean_],
        "scaler_scale": [float(v) for v in cont_trans.named_steps["scale"].scale_],
        "binary_most_frequent": [float(v) for v in bin_trans.statistics_],
    }


def extract_weights() -> dict:
    """The network's weight matrices, keyed by layer."""
    import h5py

    arrays = {}
    with h5py.File(WEIGHTS_PATH, "r") as f:
        layers = f["layers"]
        for dense in ("dense", "dense_1", "dense_2", "dense_3"):
            arrays[f"{dense}_kernel"] = np.array(layers[dense]["vars"]["0"])
            arrays[f"{dense}_bias"] = np.array(layers[dense]["vars"]["1"])
        # Keras stores BatchNormalization as [gamma, beta, moving_mean, moving_var].
        for bn in ("batch_normalization", "batch_normalization_1"):
            arrays[f"{bn}_gamma"] = np.array(layers[bn]["vars"]["0"])
            arrays[f"{bn}_beta"] = np.array(layers[bn]["vars"]["1"])
            arrays[f"{bn}_moving_mean"] = np.array(layers[bn]["vars"]["2"])
            arrays[f"{bn}_moving_var"] = np.array(layers[bn]["vars"]["3"])
    return arrays


def forward(x: np.ndarray, w: dict) -> np.ndarray:
    """The network's forward pass in numpy. Mirrors `inference.py`."""

    def bn(h, prefix):
        gamma = w[f"{prefix}_gamma"]
        beta = w[f"{prefix}_beta"]
        mean = w[f"{prefix}_moving_mean"]
        var = w[f"{prefix}_moving_var"]
        return gamma * (h - mean) / np.sqrt(var + BN_EPSILON) + beta

    h = np.maximum(0.0, x @ w["dense_kernel"] + w["dense_bias"])
    h = bn(h, "batch_normalization")
    # Dropout is identity at inference.
    h = np.maximum(0.0, h @ w["dense_1_kernel"] + w["dense_1_bias"])
    h = bn(h, "batch_normalization_1")
    h = np.maximum(0.0, h @ w["dense_2_kernel"] + w["dense_2_bias"])
    logit = h @ w["dense_3_kernel"] + w["dense_3_bias"]
    return 1.0 / (1.0 + np.exp(-logit))


def _verify_against_keras(weights: dict, n_features: int) -> float:
    """Max |numpy - keras| over random inputs, or -1 if TensorFlow is absent.

    TensorFlow is not a dependency of this repo; it is only used here, offline,
    to prove the numpy forward pass reproduces the original network.
    """
    try:
        import tensorflow as tf
        from tensorflow import keras
        from tensorflow.keras import layers
    except ImportError:
        print("[WARN] TensorFlow not installed — skipping the equivalence check.")
        return -1.0

    model = keras.Sequential(
        [
            keras.Input(shape=(n_features,)),
            layers.Dense(256, activation="relu"),
            layers.BatchNormalization(),
            layers.Dropout(0.4),
            layers.Dense(128, activation="relu"),
            layers.BatchNormalization(),
            layers.Dropout(0.3),
            layers.Dense(64, activation="relu"),
            layers.Dropout(0.2),
            layers.Dense(1, activation="sigmoid"),
        ]
    )
    model.load_weights(WEIGHTS_PATH)

    rng = np.random.default_rng(0)
    probe = rng.normal(size=(256, n_features)).astype("float32")
    keras_out = model.predict(probe, verbose=0).ravel()
    numpy_out = forward(probe.astype("float64"), weights).ravel()
    return float(np.abs(keras_out - numpy_out).max())


def convert() -> None:
    _install_sklearn_shim()
    import joblib

    stats = extract_preprocessor()
    weights = extract_weights()

    raw_order = list(joblib.load(FEATURE_ORDER_PATH))
    threshold = float(joblib.load(THRESHOLD_PATH))
    n_features = len(stats["continuous_features"]) + len(stats["binary_features"])

    print(f"[INFO] Raw features: {len(raw_order)}   Model inputs: {n_features}")
    print(f"[INFO] Decision threshold: {threshold}")

    drift = _verify_against_keras(weights, n_features)
    if drift >= 0:
        print(f"[CHECK] Max drift vs Keras: {drift:.2e}")
        if drift > 1e-5:
            raise AssertionError(
                f"numpy forward pass does not reproduce Keras (drift {drift:.2e})"
            )

    np.savez_compressed(MODEL_OUT, **weights)
    with open(SCHEMA_OUT, "w") as f:
        json.dump(
            {
                "raw_feature_order": raw_order,
                "threshold": threshold,
                "bn_epsilon": BN_EPSILON,
                **stats,
            },
            f,
            indent=2,
        )
    print(f"[SUCCESS] Saved:\n  {MODEL_OUT}\n  {SCHEMA_OUT}")


if __name__ == "__main__":
    convert()
