"""Who may call what.

The backend holds the Supabase service-role key and pays for every Gemini /
OpenAI call, so the routes that read patient data or spend model quota must
refuse anonymous callers, and the plan routes must refuse signed-in callers
reaching for someone else's plan. The free, stateless routes stay open — the
logged-out landing page relies on `/translate`.
"""
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

import auth
import db
from app import app as flask_app


@pytest.fixture
def client():
    flask_app.config["TESTING"] = True
    # The limiter counts in process memory across tests, and this file calls
    # the same few routes many times over (feedback allows 5 a minute). Start
    # every test with empty buckets so a 429 never stands in for the answer.
    flask_app.limiter.reset()
    yield flask_app.test_client()
    flask_app.limiter.reset()


PROTECTED = [
    ("POST", "/generate"),
    ("POST", "/diet-chart/generate"),
    ("GET", "/plan/plan_1"),
    ("POST", "/plan/plan_1/edit"),
    ("GET", "/plan/plan_1/edits"),
    ("POST", "/plan/plan_1/feedback"),
    ("POST", "/analysis/screening"),
    ("POST", "/assistant/ask"),
    ("POST", "/assistant/chat"),
    ("POST", "/assistant/doctor-chat"),
    ("POST", "/analysis/extract-report"),
    ("POST", "/analysis/acne-photo"),
    ("GET", "/user/test_user/plans"),
    ("GET", "/analytics"),
]


@pytest.mark.parametrize("method,path", PROTECTED)
def test_protected_routes_refuse_anonymous_callers(client, method, path):
    response = client.open(path, method=method, json={})
    assert response.status_code == 401
    assert response.get_json()["success"] is False


@pytest.mark.parametrize("method,path", PROTECTED)
def test_a_malformed_authorization_header_is_anonymous(client, method, path):
    response = client.open(
        path, method=method, json={}, headers={"Authorization": "Token abc"}
    )
    assert response.status_code == 401


@pytest.mark.parametrize(
    "method,path,body,expected",
    [
        ("GET", "/", None, 200),
        ("GET", "/disease/conditions", None, 200),
        ("GET", "/analysis/status", None, 200),
        # 400 rather than 401: the request got past any auth and was judged on
        # its body. Nothing reaches Google with an empty `texts`.
        ("POST", "/translate", {"texts": [], "target": "hi"}, 400),
        ("POST", "/disease/screen", {"age": 31, "trimester": "third", "hemoglobin": 9.1}, 200),
    ],
)
def test_free_stateless_routes_stay_public(client, method, path, body, expected):
    response = client.open(path, method=method, json=body)
    assert response.status_code == expected


# ---------------------------------------------------------------------------
# Plans: the patient, and a doctor treating her — nobody else
# ---------------------------------------------------------------------------

PLAN = {"id": "plan_1", "user_id": "patient_1", "payload": {"plan": {}}}


@pytest.fixture
def mock_db():
    with patch("app.db_manager") as mock:
        mock.get_generated_plan.return_value = dict(PLAN)
        mock.get_plan_edits.return_value = []
        mock.save_doctor_edit.return_value = "edit_1"
        mock.save_user_feedback.return_value = "feedback_1"
        yield mock


class TestReadingPlans:
    @pytest.mark.parametrize("path", ["/plan/plan_1", "/plan/plan_1/edits"])
    def test_the_patient_reads_her_own_plan(self, client, mock_db, sign_in, path):
        sign_in("patient_1")
        assert client.get(path).status_code == 200

    @pytest.mark.parametrize("path", ["/plan/plan_1", "/plan/plan_1/edits"])
    def test_her_doctor_reads_it(self, client, mock_db, sign_in, treating, path):
        sign_in("doctor_1")
        treating(("doctor_1", "patient_1"))
        assert client.get(path).status_code == 200

    @pytest.mark.parametrize("path", ["/plan/plan_1", "/plan/plan_1/edits"])
    def test_anyone_else_is_refused(self, client, mock_db, sign_in, treating, path):
        sign_in("doctor_2")
        treating(("doctor_1", "patient_1"))
        response = client.get(path)
        assert response.status_code == 403
        mock_db.get_plan_edits.assert_not_called()

    def test_a_missing_plan_is_still_404(self, client, mock_db, sign_in):
        sign_in("patient_1")
        mock_db.get_generated_plan.return_value = None
        assert client.get("/plan/plan_1").status_code == 404


class TestEditingPlans:
    BODY = {"edited_plan": {"day_1": {}}, "reason": "less salt"}

    def test_her_doctor_edits_and_is_recorded_as_the_editor(
        self, client, mock_db, sign_in, treating
    ):
        sign_in("doctor_1")
        treating(("doctor_1", "patient_1"))
        # No doctor_id in the body: the token says who is editing.
        response = client.post("/plan/plan_1/edit", json=self.BODY)
        assert response.status_code == 200
        assert mock_db.save_doctor_edit.call_args.kwargs["doctor_id"] == "doctor_1"

    def test_a_doctor_id_naming_someone_else_is_refused(
        self, client, mock_db, sign_in, treating
    ):
        sign_in("doctor_1")
        treating(("doctor_1", "patient_1"))
        response = client.post(
            "/plan/plan_1/edit", json={**self.BODY, "doctor_id": "doctor_2"}
        )
        assert response.status_code == 403
        mock_db.save_doctor_edit.assert_not_called()

    def test_a_doctor_not_treating_her_is_refused(self, client, mock_db, sign_in, treating):
        sign_in("doctor_2")
        treating(("doctor_1", "patient_1"))
        assert client.post("/plan/plan_1/edit", json=self.BODY).status_code == 403
        mock_db.save_doctor_edit.assert_not_called()

    def test_the_patient_cannot_file_a_doctor_edit(self, client, mock_db, sign_in):
        sign_in("patient_1")
        assert client.post("/plan/plan_1/edit", json=self.BODY).status_code == 403
        mock_db.save_doctor_edit.assert_not_called()


class TestPlanFeedback:
    def test_feedback_is_filed_under_the_signed_in_caller(self, client, mock_db, sign_in):
        sign_in("patient_1")
        response = client.post("/plan/plan_1/feedback", json={"rating": 5})
        assert response.status_code == 200
        assert mock_db.save_user_feedback.call_args.kwargs["user_id"] == "patient_1"

    def test_a_user_id_naming_someone_else_is_refused(self, client, mock_db, sign_in):
        sign_in("patient_1")
        response = client.post(
            "/plan/plan_1/feedback", json={"rating": 5, "user_id": "patient_2"}
        )
        assert response.status_code == 403
        mock_db.save_user_feedback.assert_not_called()

    def test_someone_elses_plan_is_refused(self, client, mock_db, sign_in, treating):
        sign_in("patient_2")
        treating()
        assert client.post("/plan/plan_1/feedback", json={"rating": 5}).status_code == 403
        mock_db.save_user_feedback.assert_not_called()


class TestGeneratingPlans:
    REQUEST = {
        "user_profile": {
            "Age": 30, "Gender": "female", "Weight_kg": 60.0, "Height_cm": 160.0,
            "Physical_Activity_Level": "moderate", "Goal": "maintenance",
            "Food_preference": "vegetarian",
        },
        "days": 1,
    }

    def test_a_plan_for_a_patient_you_do_not_treat_is_refused_before_any_work(
        self, client, sign_in, treating
    ):
        sign_in("doctor_2")
        treating(("doctor_1", "patient_1"))
        body = {**self.REQUEST, "user_profile": {**self.REQUEST["user_profile"], "Patient_ID": "patient_1"}}
        with patch("app.meal_planner") as planner:
            response = client.post("/generate", json=body)
        assert response.status_code == 403
        planner.generate_meal_plan_advanced.assert_not_called()

    def test_without_a_patient_id_the_plan_is_saved_as_the_callers(self, client, sign_in):
        sign_in("patient_1")
        with patch("app.get_datasets", return_value={"food": Mock(), "dosha": Mock()}), \
             patch("app.dosha_predictor"), \
             patch("app.get_calorie_breakdown", return_value={"target_calories": 2000.0}), \
             patch("app.meal_planner") as planner, \
             patch("app.db_manager") as mock_db:
            from models import DoshaResult, DoshaEnum
            import app as app_module
            app_module.dosha_predictor.predict_dosha_hybrid.return_value = DoshaResult(
                dosha=DoshaEnum.VATA, scores={"vata": 1.0}, confidence=0.9, method="test"
            )
            planner.generate_meal_plan_advanced.return_value = {"day_1": {}}
            mock_db.save_generated_plan.return_value = "plan_9"
            response = client.post("/generate", json=self.REQUEST)
        assert response.status_code == 200
        assert mock_db.save_generated_plan.call_args.kwargs["user_id"] == "patient_1"


# ---------------------------------------------------------------------------
# The doctor-patient rule itself
# ---------------------------------------------------------------------------

class TestCanAccessPatient:
    def test_a_patient_can_access_herself_without_a_lookup(self, monkeypatch):
        monkeypatch.setattr(auth, "_treats_patient", Mock(side_effect=AssertionError))
        assert auth.can_access_patient("patient_1", "patient_1") is True

    @pytest.mark.parametrize("caller,patient", [(None, "p"), ("", "p"), ("d", None), ("d", "")])
    def test_a_missing_id_grants_nothing(self, caller, patient):
        assert auth.can_access_patient(caller, patient) is False

    def test_the_lookup_asks_for_a_treating_consultation(self, monkeypatch):
        query = Mock()
        for step in ("select", "eq", "in_", "limit"):
            getattr(query, step).return_value = query
        query.execute.return_value = SimpleNamespace(data=[{"patient_id": "patient_1"}])
        fake = SimpleNamespace(db=SimpleNamespace(table=Mock(return_value=query)))
        monkeypatch.setattr(db, "db_manager", fake)

        assert auth.can_access_patient("doctor_1", "patient_1") is True
        fake.db.table.assert_called_once_with("consultation_requests")
        query.in_.assert_called_once_with("status", ["pending", "accepted", "completed"])

    def test_no_matching_consultation_means_no_access(self, monkeypatch):
        query = Mock()
        for step in ("select", "eq", "in_", "limit"):
            getattr(query, step).return_value = query
        query.execute.return_value = SimpleNamespace(data=[])
        monkeypatch.setattr(
            db, "db_manager", SimpleNamespace(db=SimpleNamespace(table=Mock(return_value=query)))
        )
        assert auth.can_access_patient("doctor_2", "patient_1") is False

    def test_a_failed_lookup_fails_closed(self, monkeypatch):
        broken = SimpleNamespace(db=SimpleNamespace(table=Mock(side_effect=RuntimeError("down"))))
        monkeypatch.setattr(db, "db_manager", broken)
        assert auth.can_access_patient("doctor_1", "patient_1") is False
