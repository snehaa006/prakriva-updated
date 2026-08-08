"""Feature spec for the gestational diabetes (GDM) model.

Shared by training (`train_gdm_model.py`) and inference (`inference.py`) so the
two cannot drift, mirroring the arrangement in `featurize.py` for the maternal
anaemia models.

The model is a *pre-OGTT early screening* model: the notebook deliberately drops
the 75g OGTT results and fasting glucose from the training data to avoid target
leakage, so it estimates GDM risk from routine antenatal facts available before
the diagnostic glucose test is done.

Feature selection
-----------------
The source notebook trained on 18 features. Three were dropped here, verified
against the dataset to cost almost nothing (ROC-AUC 0.826 -> 0.823):

* `snp_genetic_risk_score` — a genetic score no patient can be expected to
  know. Correlates only +0.067 with the outcome.
* `height_cm`, `weight_kg` — fully redundant with `bmi`, which is derived from
  them. Dropping both changed AUC by less than 0.0001.

Of the 15 that remain, 12 are already collected elsewhere in the app and are
mapped straight off `ScreeningInput`; only `known_prediabetes`, `hdl` and
`triglycerides` needed new fields.
"""

#: Model input columns, in the exact order the estimator was trained on.
FEATURE_COLUMNS = [
    "age",
    "bmi",
    "systolic_bp",
    "diastolic_bp",
    "no_of_pregnancies",
    "prior_gdm",
    "family_history_diabetes",
    "prior_unexplained_loss",
    "prior_macrosomia",
    "pcos_diagnosed",
    "known_prediabetes",
    "sedentary_lifestyle",
    "hba1c_pct",
    "hdl_mgdL",
    "triglycerides_mgdL",
]

#: Columns excluded from the raw dataset. The OGTT/fasting-glucose values are
#: the diagnostic test itself — including them would leak the target.
LEAKY_COLUMNS = [
    "sample_id",
    "gdm_status",
    "fasting_glucose_mgdL",
    "ogtt_1hr_mgdL",
    "ogtt_2hr_mgdL",
]

#: Risk tiers from the notebook's stratification table, mapped onto the
#: pipeline's low/moderate/high levels. Upper bound is exclusive.
RISK_TIERS = [
    (0.35, "low"),
    (0.60, "moderate"),
    (1.01, "high"),
]


def risk_level_for(probability: float) -> str:
    """The pipeline risk level for a predicted GDM probability."""
    for upper, level in RISK_TIERS:
        if probability < upper:
            return level
    return "high"
