"""Feature spec for the preeclampsia model.

Shared by the conversion script and inference, mirroring the arrangement used by
the other models.

The source is a scikit-learn Pipeline (median impute + standardise, then a
class-balanced logistic regression) over 13 antenatal features. The pipeline's
ColumnTransformer emits the ten continuous features first and the three binary
ones after, so `FEATURE_COLUMNS` below is that *output* order — not the order
the raw columns appear in the original dataset.

Nine of the thirteen already exist on `ScreeningInput`. The four that did not —
diabetes, history of hypertension, fetal weight and amniotic fluid — are the
only new questions.
"""

#: Continuous block, in the order the preprocessor emits it.
CONTINUOUS_FEATURES = [
    "gravida",
    "parity",
    "gestational age (weeks)",
    "Age (yrs)",
    "BMI  [kg/m²]",
    "Systolic BP",
    "Diastolic BP",
    "HB",
    "fetal weight(kgs)",
    "amniotic fluid levels(cm)",
]

#: Binary block, appended after the continuous one.
BINARY_FEATURES = [
    "diabetes",
    "History of hypertension (y/n)",
    "Protien Uria",
]

#: Full model input order.
FEATURE_COLUMNS = CONTINUOUS_FEATURES + BINARY_FEATURES

#: Risk bands for the predicted probability, matching the GDM model's tiers so
#: a "moderate" means the same thing to a clinician across both conditions.
def risk_level_for(probability: float) -> str:
    """The pipeline risk level for a predicted preeclampsia probability."""
    if probability < 0.35:
        return "low"
    if probability < 0.60:
        return "moderate"
    return "high"
