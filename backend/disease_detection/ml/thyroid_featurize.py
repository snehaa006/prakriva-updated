"""Feature spec for the thyroid disorder model.

Shared by the conversion script (`convert_thyroid_model.py`) and inference
(`inference.py`), mirroring the arrangement used by the other two models.

The network was trained on the classic UCI thyroid dataset, whose 31 raw
features fall into three groups:

* **6 continuous labs** — age, TSH, T3, TT4, T4U, FTI. Median-imputed then
  standardised.
* **6 "measured" flags** — whether each lab was actually run. These are
  *derived*, never asked: a value being present is the same statement as the
  flag being set, so asking twice would only create a way for the two to
  disagree.
* **4 referral-source one-hots** — which clinic referred the patient. Not
  meaningful in this app, so they take the training-set defaults.

That leaves the clinical history flags as the only genuinely new questions.
"""

#: Continuous features, in the order the preprocessor's `cont` block expects.
CONTINUOUS_FEATURES = ["age", "TSH", "T3", "TT4", "T4U", "FTI"]

#: Binary features, in the order the preprocessor's `bin` block expects.
BINARY_FEATURES = [
    "sex",
    "on thyroxine",
    "query on thyroxine",
    "on antithyroid medication",
    "sick",
    "pregnant",
    "thyroid surgery",
    "I131 treatment",
    "query hypothyroid",
    "query hyperthyroid",
    "lithium",
    "goitre",
    "tumor",
    "hypopituitary",
    "psych",
    "TSH measured",
    "T3 measured",
    "TT4 measured",
    "T4U measured",
    "FTI measured",
    "TBG measured",
    "ref_SVHC",
    "ref_SVHD",
    "ref_SVI",
    "ref_other",
]

#: Lab -> its "<lab> measured" companion flag, derived from whether the value
#: was supplied rather than asked for separately.
MEASURED_FLAGS = {
    "TSH": "TSH measured",
    "T3": "T3 measured",
    "TT4": "TT4 measured",
    "T4U": "T4U measured",
    "FTI": "FTI measured",
}

#: Referral-source one-hots. The training data came from specific clinics that
#: have no counterpart here, so every patient is scored as "other" — the
#: majority class in the training set.
REFERRAL_DEFAULTS = {
    "ref_SVHC": 0,
    "ref_SVHD": 0,
    "ref_SVI": 0,
    "ref_other": 1,
}

#: TBG was dropped during cleaning (almost entirely missing), so it is never
#: measured here.
TBG_MEASURED_DEFAULT = 0

#: Risk bands for the predicted probability. The decision threshold saved with
#: the model separates low from raised; "high" is the clearly-elevated band
#: above it, so a borderline case is not presented with the same weight as an
#: unambiguous one.
def risk_level_for(probability: float, threshold: float) -> str:
    """The pipeline risk level for a predicted thyroid-risk probability."""
    if probability < threshold:
        return "low"
    # Halfway between the threshold and certainty marks the clearly-elevated band.
    if probability < threshold + (1.0 - threshold) / 2.0:
        return "moderate"
    return "high"
