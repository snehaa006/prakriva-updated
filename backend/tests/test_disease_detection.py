"""Tests for the maternal disease detection pipeline and its endpoints."""
import os
import sys

import pytest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app as flask_app
from disease_detection import (
    CONDITIONS,
    ConditionRisk,
    RiskLevel,
    ScreeningInput,
    register_detector,
    reset_detectors,
    run_screening,
)
from disease_detection.pipeline import UnknownConditionError
from disease_detection.rules import classify


@pytest.fixture
def client():
    flask_app.config["TESTING"] = True
    return flask_app.test_client()


@pytest.fixture(autouse=True)
def baseline_detectors():
    """Every test starts and ends on the rule-based baseline."""
    reset_detectors()
    yield
    reset_detectors()


@pytest.fixture
def healthy_input():
    """A low-risk second-trimester pregnancy with unremarkable labs."""
    return ScreeningInput(
        age=27,
        trimester="second",
        bmi=22.5,
        gravida=1,
        bp_systolic=112,
        bp_diastolic=72,
        hemoglobin=12.4,
        tsh=1.8,
        social_support=4,
    )


class TestScreeningInput:
    def test_symptoms_are_normalised(self):
        parsed = ScreeningInput(age=30, symptoms=["Cold hands/feet", "FATIGUE"])
        assert parsed.symptoms == ["cold_hands_feet", "fatigue"]

    def test_duplicate_symptoms_collapse(self):
        parsed = ScreeningInput(age=30, symptoms=["fatigue", "fatigue"])
        assert parsed.symptoms == ["fatigue"]

    def test_unknown_symptom_is_rejected(self):
        with pytest.raises(ValueError, match="Unknown symptom"):
            ScreeningInput(age=30, symptoms=["sneezing"])

    def test_age_bounds_enforced(self):
        with pytest.raises(ValueError):
            ScreeningInput(age=5)


class TestClassification:
    @pytest.mark.parametrize(
        "score,expected",
        [
            (0, RiskLevel.LOW),
            (29.9, RiskLevel.LOW),
            (30, RiskLevel.MODERATE),
            (59.9, RiskLevel.MODERATE),
            (60, RiskLevel.HIGH),
            (100, RiskLevel.HIGH),
        ],
    )
    def test_thresholds(self, score, expected):
        assert classify(score) == expected


class TestBaselineDetectors:
    def test_healthy_patient_is_low_risk_everywhere(self, healthy_input):
        result = run_screening(healthy_input)

        assert len(result.conditions) == len(CONDITIONS)
        assert result.overall_risk_level == RiskLevel.LOW
        assert all(r.risk_level == RiskLevel.LOW for r in result.conditions)

    def test_severe_anaemia_flags_high(self, healthy_input):
        inputs = healthy_input.model_copy(
            update={
                "hemoglobin": 6.5,
                "anaemia_history": True,
                "symptoms": ["fatigue", "pale_skin", "shortness_of_breath"],
            }
        )
        anaemia = next(
            r for r in run_screening(inputs).conditions if r.condition == "anaemia"
        )

        assert anaemia.risk_level == RiskLevel.HIGH
        assert any("Severe anaemia" in reason for reason in anaemia.reasons)
        assert anaemia.recommendations

    def test_preeclampsia_from_bp_and_proteinuria(self, healthy_input):
        inputs = healthy_input.model_copy(
            update={
                "bp_systolic": 165,
                "bp_diastolic": 112,
                "proteinuria": "positive",
                "symptoms": ["blurred_vision", "headache"],
            }
        )
        preeclampsia = next(
            r for r in run_screening(inputs).conditions if r.condition == "preeclampsia"
        )

        assert preeclampsia.risk_level == RiskLevel.HIGH
        assert any("Severe hypertension" in r for r in preeclampsia.reasons)

    def test_thyroid_subtype_follows_tsh(self, healthy_input):
        hypo = next(
            r
            for r in run_screening(
                healthy_input.model_copy(update={"tsh": 8.2})
            ).conditions
            if r.condition == "thyroid"
        )
        hyper = next(
            r
            for r in run_screening(
                healthy_input.model_copy(update={"tsh": 0.1})
            ).conditions
            if r.condition == "thyroid"
        )

        assert hypo.details["thyroid_type"] == "Hypothyroidism (underactive)"
        assert hyper.details["thyroid_type"] == "Hyperthyroidism (overactive)"

    def test_gdm_scales_with_hba1c(self, healthy_input):
        prediabetes = next(
            r
            for r in run_screening(
                healthy_input.model_copy(update={"hba1c": 5.9})
            ).conditions
            if r.condition == "gdm"
        )
        diabetes = next(
            r
            for r in run_screening(
                healthy_input.model_copy(update={"hba1c": 7.1})
            ).conditions
            if r.condition == "gdm"
        )

        assert diabetes.score > prediabetes.score > 0

    def test_missing_labs_do_not_score(self, healthy_input):
        """A test that was never performed must not read as a normal result."""
        without_labs = healthy_input.model_copy(
            update={"hemoglobin": None, "tsh": None, "urine_wbc": None}
        )
        anaemia = next(
            r for r in run_screening(without_labs).conditions if r.condition == "anaemia"
        )

        assert anaemia.score == 0
        assert anaemia.reasons == []

    def test_mental_health_uses_screening_scales(self, healthy_input):
        inputs = healthy_input.model_copy(
            update={
                "edinburgh_score": 18,
                "phq9_score": 17,
                "stress_level": 3,
                "sleep_disturbance": 3,
                "social_support": 1,
                "history_depression": True,
            }
        )
        mental = next(
            r
            for r in run_screening(inputs).conditions
            if r.condition == "mental_health"
        )

        assert mental.risk_level == RiskLevel.HIGH
        assert any("EPDS" in r for r in mental.reasons)

    def test_results_are_sorted_by_score(self, healthy_input):
        inputs = healthy_input.model_copy(
            update={"hemoglobin": 6.2, "symptoms": ["fatigue", "pale_skin"]}
        )
        scores = [r.score for r in run_screening(inputs).conditions]

        assert scores == sorted(scores, reverse=True)

    def test_score_is_capped_at_100(self, healthy_input):
        worst_case = healthy_input.model_copy(
            update={
                "age": 42,
                "bmi": 38.0,
                "hemoglobin": 5.0,
                "anaemia_history": True,
                "gravida": 4,
                "trimester": "third",
                "symptoms": [
                    "fatigue",
                    "dizziness",
                    "pale_skin",
                    "cold_hands_feet",
                    "shortness_of_breath",
                    "palpitations",
                    "headache",
                ],
            }
        )
        assert all(r.score <= 100 for r in run_screening(worst_case).conditions)


class TestRegistry:
    def test_subset_of_conditions_can_be_run(self, healthy_input):
        result = run_screening(healthy_input, ["anaemia", "gdm"])

        assert [r.condition for r in result.conditions] == ["anaemia", "gdm"] or {
            r.condition for r in result.conditions
        } == {"anaemia", "gdm"}

    def test_unknown_condition_raises(self, healthy_input):
        with pytest.raises(UnknownConditionError):
            run_screening(healthy_input, ["diabetes_type_1"])

    def test_detector_can_be_replaced(self, healthy_input):
        def stub(inputs):
            return ConditionRisk(
                condition="anaemia",
                label=CONDITIONS["anaemia"],
                score=91.0,
                risk_level=RiskLevel.HIGH,
                reasons=["model says so"],
                detector="anaemia-stub-v9",
            )

        register_detector("anaemia", stub, replace=True)
        anaemia = next(
            r for r in run_screening(healthy_input).conditions if r.condition == "anaemia"
        )

        assert anaemia.detector == "anaemia-stub-v9"
        assert anaemia.score == 91.0

    def test_replacing_without_flag_raises(self):
        with pytest.raises(ValueError, match="already registered"):
            register_detector("anaemia", lambda inputs: None)

    def test_registering_unknown_condition_raises(self):
        with pytest.raises(UnknownConditionError):
            register_detector("common_cold", lambda inputs: None)


class TestMLDetectors:
    """The trained-model detectors, skipped when XGBoost/artifacts are absent."""

    @pytest.fixture(autouse=True)
    def ml_detectors(self):
        pytest.importorskip("xgboost")
        from disease_detection.ml import register_ml_detectors

        if not register_ml_detectors(replace=True):
            pytest.skip("Maternal model artifacts not available")
        yield
        reset_detectors()

    def test_ml_detectors_are_active(self):
        from disease_detection import available_conditions

        active = {c["condition"]: c["detector"] for c in available_conditions()}
        assert active["anaemia"] == "anaemia-xgb-v1"
        assert active["pregnancy_risk"] == "pregnancy-risk-xgb-v1"

    def test_severe_case_is_high_risk(self, healthy_input):
        inputs = healthy_input.model_copy(
            update={"hemoglobin": 6.8, "bp_systolic": 150, "bp_diastolic": 95, "age": 38}
        )
        result = run_screening(inputs)
        anaemia = next(c for c in result.conditions if c.condition == "anaemia")
        risk = next(c for c in result.conditions if c.condition == "pregnancy_risk")

        assert anaemia.details["anemia_status"] == "Severe"
        assert anaemia.risk_level == RiskLevel.HIGH
        assert risk.details["pregnancy_risk"] == "High"
        assert result.overall_risk_level == RiskLevel.HIGH

    def test_missing_haemoglobin_falls_back_to_rules(self, healthy_input):
        inputs = healthy_input.model_copy(update={"hemoglobin": None})
        anaemia = next(
            c for c in run_screening(inputs).conditions if c.condition == "anaemia"
        )
        # Falls back to the rule-based detector, not the model.
        assert anaemia.detector == "rules-v1"

    def test_gdm_model_is_active(self):
        from disease_detection import available_conditions

        active = {c["condition"]: c["detector"] for c in available_conditions()}
        assert active["gdm"] == "gdm-logreg-v1"

    def test_gdm_separates_high_from_low_risk(self, healthy_input):
        low = next(
            c for c in run_screening(healthy_input).conditions if c.condition == "gdm"
        )
        high_input = healthy_input.model_copy(
            update={
                "age": 38,
                "bmi": 34.0,
                "gestational_diabetes_previous": True,
                "known_prediabetes": True,
                "family_history": True,
                "pcos": True,
                "hba1c": 6.0,
            }
        )
        high = next(
            c for c in run_screening(high_input).conditions if c.condition == "gdm"
        )

        assert high.score > low.score
        assert high.risk_level == RiskLevel.HIGH
        assert low.risk_level == RiskLevel.LOW

    def test_gdm_flags_when_labs_were_imputed(self, healthy_input):
        """A score built partly on population averages must say so."""
        no_labs = healthy_input.model_copy(
            update={"hba1c": None, "hdl": None, "triglycerides": None}
        )
        gdm = next(c for c in run_screening(no_labs).conditions if c.condition == "gdm")

        assert set(gdm.details["imputed_features"]) == {
            "hba1c_pct",
            "hdl_mgdL",
            "triglycerides_mgdL",
        }
        assert any("Estimated without" in r for r in gdm.reasons)

    def test_gdm_never_reports_a_certainty(self, healthy_input):
        """A saturated logistic must not read as a diagnosis."""
        extreme = healthy_input.model_copy(
            update={
                "age": 45,
                "bmi": 45.0,
                "gestational_diabetes_previous": True,
                "known_prediabetes": True,
                "family_history": True,
                "pcos": True,
                "large_baby_previous": True,
                "hba1c": 6.1,
                "hdl": 20,
                "triglycerides": 433,
            }
        )
        gdm = next(c for c in run_screening(extreme).conditions if c.condition == "gdm")

        assert not any("100%" in r for r in gdm.reasons)

    def test_gdm_without_bmi_falls_back_to_rules(self, healthy_input):
        inputs = healthy_input.model_copy(update={"bmi": None})
        gdm = next(c for c in run_screening(inputs).conditions if c.condition == "gdm")

        assert gdm.detector == "rules-v1"


class TestEndpoints:
    def test_conditions_endpoint(self, client):
        response = client.get("/disease/conditions")
        body = response.get_json()

        assert response.status_code == 200
        assert body["success"] is True
        assert len(body["data"]["conditions"]) == len(CONDITIONS)
        assert body["data"]["symptoms"]

    def test_screen_endpoint_returns_all_conditions(self, client):
        response = client.post(
            "/disease/screen",
            json={"age": 31, "trimester": "third", "bmi": 24.0, "hemoglobin": 9.1},
        )
        body = response.get_json()

        assert response.status_code == 200
        assert body["success"] is True
        assert len(body["data"]["conditions"]) == len(CONDITIONS)
        assert body["data"]["overall_risk_level"] in {"low", "moderate", "high"}

    def test_screen_endpoint_rejects_bad_input(self, client):
        response = client.post("/disease/screen", json={"age": 3})

        assert response.status_code == 400
        assert response.get_json()["success"] is False

    def test_screen_endpoint_rejects_unknown_condition(self, client):
        response = client.post(
            "/disease/screen", json={"age": 30, "conditions": ["scurvy"]}
        )

        assert response.status_code == 400

    def test_screen_endpoint_requires_json(self, client):
        response = client.post("/disease/screen", data="age=30")

        assert response.status_code == 400
