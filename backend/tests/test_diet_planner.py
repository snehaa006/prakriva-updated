"""Tests for Gemini-backed diet chart generation and API key rotation.

Nothing here talks to Gemini: `requests.post` is stubbed throughout, so the
suite stays offline and needs no key.
"""
import json
from unittest.mock import patch

import pytest

import diet_planner
import gemini_service
from config import settings
from gemini_service import GeminiUnavailable


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def payload():
    """A realistic request body from the frontend."""
    return {
        "days": 2,
        "profile": {
            "ageYears": 29,
            "lifeStage": "pregnancy",
            "lifeStageLabel": "Pregnancy (second trimester)",
            "dietaryPreferences": "vegetarian",
            "healthGoals": ["healthy pregnancy"],
            "currentConditions": [],
            "digestionIssues": ["acidity"],
        },
        "dosha": {
            "primary": "pitta",
            "scores": {"vata": 3, "pitta": 9, "kapha": 2},
            "description": "Cool, sweet foods.",
            "spices": ["coriander", "fennel"],
            "cookingMethods": ["steaming"],
        },
        "targets": {
            "calories": {"min": 2140, "max": 2740, "label": "Pregnancy (2nd Trimester)"},
            "protein": {"min": 71, "max": 100, "unit": "g/day"},
            "iron": {"min": 27, "unit": "mg/day"},
            "notes": ["Iron-rich foods: spinach, legumes"],
        },
        "excludeIngredients": ["peanut", "raw fish", "alcohol"],
        "focusIngredients": ["spinach", "lentil", "rice"],
        "pantry": {
            "atHome": [{"name": "Rice (white)", "quantity": "2 kg", "category": "Grains"}],
            "toBuy": [{"name": "Spinach", "quantity": "1 bunch"}],
        },
        "screenings": [
            {
                "createdAt": "2026-05-12",
                "result": {
                    "overall_risk_level": "high",
                    "conditions": [
                        {"label": "Anaemia", "risk_level": "high", "reasons": ["Hb 9.1 g/dL"]},
                        {"label": "Thyroid Disorder", "risk_level": "low", "reasons": ["TSH normal"]},
                    ],
                },
            }
        ],
    }


def gemini_reply(days=2, meals_per_day=None):
    """A well-formed Gemini response for `days` days."""
    meals_per_day = meals_per_day or ["breakfast", "mid_morning", "lunch", "afternoon_snack", "dinner"]
    return {
        "days": [
            {
                "dayNumber": day,
                "meals": [
                    {
                        "mealType": meal_type,
                        "recipeTitle": f"Dish {day}-{meal_type}",
                        "ingredients": ["rice", "spinach"],
                        "fromPantry": ["rice"],
                        "toBuy": ["spinach"],
                        "calories": 400,
                        "protein": 15,
                        "carbs": 60,
                        "fat": 10,
                        "cookTimeMinutes": 25,
                        "reason": "Cooling and iron-rich.",
                    }
                    for meal_type in meals_per_day
                ],
            }
            for day in range(1, days + 1)
        ],
        "clinicalFocus": ["Iron pairings for the anaemia flag"],
        "pantryGaps": ["spinach"],
        "summary": "A cooling, iron-forward vegetarian week.",
    }


class FakeResponse:
    def __init__(self, status_code, body=None, text=""):
        self.status_code = status_code
        self._body = body or {}
        self.text = text

    def json(self):
        return self._body


def ok_response(reply):
    return FakeResponse(
        200,
        {"candidates": [{"content": {"parts": [{"text": json.dumps(reply)}]}}]},
    )


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

class TestPromptBuilding:
    def test_prompt_carries_pantry_screening_and_exclusions(self, payload):
        prompt = diet_planner.build_diet_prompt(payload, days=2, daily_calories=2440)

        assert "Rice (white) (2 kg, Grains)" in prompt
        assert "Spinach" in prompt
        assert "peanut" in prompt
        assert "Anaemia: HIGH" in prompt
        assert "2440 kcal" in prompt

    def test_low_risk_conditions_are_left_out(self, payload):
        prompt = diet_planner.build_diet_prompt(payload, days=2, daily_calories=2440)

        # A condition the models did not flag should not steer the menu.
        assert "Thyroid Disorder" not in prompt

    def test_prompt_carries_no_identifiers(self, payload):
        payload["profile"]["name"] = "Should Not Appear"
        prompt = diet_planner.build_diet_prompt(payload, days=2, daily_calories=2440)

        assert "Should Not Appear" not in prompt

    def test_empty_pantry_is_stated_rather_than_omitted(self, payload):
        payload["pantry"] = {"atHome": [], "toBuy": []}
        prompt = diet_planner.build_diet_prompt(payload, days=1, daily_calories=2000)

        assert "no pantry list recorded" in prompt

    def test_absent_screening_is_stated(self, payload):
        payload["screenings"] = []
        prompt = diet_planner.build_diet_prompt(payload, days=1, daily_calories=2000)

        assert "no disease screening on record" in prompt


# ---------------------------------------------------------------------------
# Response normalisation
# ---------------------------------------------------------------------------

class TestNormalisation:
    def normalise(self, raw, **kwargs):
        options = {
            "days": 2,
            "daily_calories": 2000,
            "meal_structure": diet_planner.DEFAULT_MEAL_STRUCTURE,
            "excluded": ["peanut", "egg"],
        }
        options.update(kwargs)
        return diet_planner.normalise_plan(raw, **options)

    def test_produces_the_frontend_recipe_shape(self):
        plan = self.normalise(gemini_reply(days=1))
        meal = plan["days"][0]["meals"][0]

        assert meal["mealType"] == "breakfast"
        assert meal["label"] == "Breakfast"
        assert meal["recipe"]["Recipe_title"] == "Dish 1-breakfast"
        assert meal["recipe"]["Protein (g)"] == "15.0"
        assert meal["recipe"]["fromPantry"] == ["rice"]

    def test_day_totals_are_summed(self):
        plan = self.normalise(gemini_reply(days=1))
        day = plan["days"][0]

        assert day["totalCalories"] == 5 * 400
        assert day["totalProtein"] == 75.0
        assert day["dayLabel"] == "Monday"

    def test_meals_naming_an_excluded_ingredient_are_dropped(self):
        reply = gemini_reply(days=1)
        reply["days"][0]["meals"][0]["ingredients"] = ["peanut butter", "toast"]

        plan = self.normalise(reply)

        titles = [m["recipe"]["Recipe_title"] for m in plan["days"][0]["meals"]]
        assert "Dish 1-breakfast" not in titles
        assert len(plan["rejectedMeals"]) == 1
        assert "peanut" in plan["rejectedMeals"][0]

    def test_exclusion_match_does_not_fire_inside_a_longer_word(self):
        # "egg" is excluded; "eggplant" is a different food and must survive.
        reply = gemini_reply(days=1)
        reply["days"][0]["meals"][0]["ingredients"] = ["eggplant", "cumin"]

        plan = self.normalise(reply)

        assert plan["rejectedMeals"] == []
        assert len(plan["days"][0]["meals"]) == 5

    def test_exclusion_checks_the_dish_name_too(self):
        reply = gemini_reply(days=1)
        reply["days"][0]["meals"][0]["recipeTitle"] = "Peanut chutney"
        reply["days"][0]["meals"][0]["ingredients"] = ["chilli"]

        plan = self.normalise(reply)

        assert len(plan["rejectedMeals"]) == 1

    def test_unknown_meal_slots_are_ignored(self):
        reply = gemini_reply(days=1)
        reply["days"][0]["meals"].append({"mealType": "midnight_feast", "calories": 900})

        plan = self.normalise(reply)

        assert len(plan["days"][0]["meals"]) == 5

    def test_meals_are_reordered_into_slot_order(self):
        reply = gemini_reply(days=1)
        reply["days"][0]["meals"].reverse()

        plan = self.normalise(reply)

        assert [m["mealType"] for m in plan["days"][0]["meals"]] == [
            "breakfast", "mid_morning", "lunch", "afternoon_snack", "dinner"
        ]

    def test_extra_days_beyond_the_request_are_trimmed(self):
        plan = self.normalise(gemini_reply(days=5), days=2)

        assert len(plan["days"]) == 2

    def test_missing_macros_default_to_zero_rather_than_crashing(self):
        reply = {"days": [{"dayNumber": 1, "meals": [
            {"mealType": "lunch", "recipeTitle": "Khichdi", "calories": "480"}
        ]}]}

        plan = self.normalise(reply)

        assert plan["days"][0]["meals"][0]["recipe"]["Protein (g)"] == "0.0"
        assert plan["days"][0]["totalCalories"] == 480

    def test_a_reply_with_no_days_is_unavailable(self):
        with pytest.raises(GeminiUnavailable):
            self.normalise({"days": []})

    def test_a_plan_whose_every_meal_was_rejected_is_unavailable(self):
        reply = gemini_reply(days=1)
        for meal in reply["days"][0]["meals"]:
            meal["ingredients"] = ["peanut oil"]

        with pytest.raises(GeminiUnavailable):
            self.normalise(reply)


# ---------------------------------------------------------------------------
# End-to-end generation
# ---------------------------------------------------------------------------

class TestGenerateDietChart:
    def test_generates_a_plan(self, payload):
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch("gemini_service.requests.post", return_value=ok_response(gemini_reply())):
            plan = diet_planner.generate_diet_chart(payload)

        assert len(plan["days"]) == 2
        assert plan["source"] == "gemini"
        # Midpoint of the pregnancy calorie band.
        assert plan["dailyCalorieTarget"] == 2440
        assert plan["clinicalFocus"] == ["Iron pairings for the anaemia flag"]

    def test_day_count_is_capped(self, payload):
        payload["days"] = 90

        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch("gemini_service.requests.post", return_value=ok_response(gemini_reply(days=20))) as post:
            diet_planner.generate_diet_chart(payload)

        prompt = post.call_args.kwargs["json"]["contents"][0]["parts"][0]["text"]
        assert f"Compose a {diet_planner.MAX_DAYS}-day" in prompt

    def test_without_a_key_it_is_unavailable(self, payload):
        with patch.object(settings, "GEMINI_API_KEYS", []):
            with pytest.raises(GeminiUnavailable):
                diet_planner.generate_diet_chart(payload)


# ---------------------------------------------------------------------------
# Key rotation
# ---------------------------------------------------------------------------

class TestKeyRotation:
    @pytest.fixture(autouse=True)
    def reset_rotation_state(self):
        """Rotation state is module-level, so it must not leak between tests.

        Both halves matter: the active-key pointer *and* the cooldown table. A
        key parked by one test would otherwise be sorted to the back of the
        candidate order in the next one.
        """
        gemini_service._active_key_index = 0
        gemini_service._cooldown_until.clear()
        yield
        gemini_service._active_key_index = 0
        gemini_service._cooldown_until.clear()

    def keys_used(self, post):
        return [call.kwargs["params"]["key"] for call in post.call_args_list]

    def test_a_quota_exhausted_key_falls_through_to_the_next(self):
        responses = [FakeResponse(429, text="quota exceeded"), ok_response(gemini_reply(days=1))]

        with patch.object(settings, "GEMINI_API_KEYS", ["key-a", "key-b"]), \
             patch("gemini_service.requests.post", side_effect=responses) as post:
            gemini_service.generate("hello", "rules")

        assert self.keys_used(post) == ["key-a", "key-b"]

    def test_the_working_key_is_reused_on_the_next_call(self):
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a", "key-b"]), \
             patch("gemini_service.requests.post", side_effect=[
                 FakeResponse(429), ok_response(gemini_reply(days=1)), ok_response(gemini_reply(days=1))
             ]) as post:
            gemini_service.generate("hello", "rules")
            gemini_service.generate("hello again", "rules")

        # The exhausted key is not retried on the second call.
        assert self.keys_used(post) == ["key-a", "key-b", "key-b"]

    def test_a_revoked_key_rotates(self):
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a", "key-b"]), \
             patch("gemini_service.requests.post", side_effect=[
                 FakeResponse(403, text="forbidden"), ok_response(gemini_reply(days=1))
             ]) as post:
            gemini_service.generate("hello", "rules")

        assert len(self.keys_used(post)) == 2

    def test_a_400_rotates(self):
        # Gemini also returns 400 for a disabled or malformed key, so it counts
        # as the key's problem rather than the request's.
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a", "key-b"]), \
             patch("gemini_service.requests.post", side_effect=[
                 FakeResponse(400, text="API key not valid"), ok_response(gemini_reply(days=1))
             ]) as post:
            gemini_service.generate("hello", "rules")

        assert len(self.keys_used(post)) == 2

    def test_a_status_no_key_can_fix_is_raised_without_burning_the_pool(self):
        # A 404 means the model ID is gone, not that the key is bad: it fails
        # identically on every key, so the pool must come out untouched while
        # the model chain is what gets worked through.
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a", "key-b"]), \
             patch("gemini_service.requests.post",
                   return_value=FakeResponse(404, text="model not found")) as post:
            with pytest.raises(GeminiUnavailable):
                gemini_service.generate("hello", "rules")

        assert set(self.keys_used(post)) == {"key-a"}
        assert gemini_service._cooldown_until == {}

    def test_when_every_key_fails_it_gives_up(self):
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a", "key-b", "key-c"]), \
             patch("gemini_service.requests.post", return_value=FakeResponse(429)) as post:
            with pytest.raises(GeminiUnavailable, match="Gemini is unavailable"):
                gemini_service.generate("hello", "rules")

        assert sorted(self.keys_used(post)) == ["key-a", "key-b", "key-c"]

    def test_a_cooling_key_is_tried_last_rather_than_dropped(self):
        # Every key cooling must still leave a usable call — the pool degrades
        # in ordering, never in availability.
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a", "key-b"]), \
             patch("gemini_service.requests.post", return_value=FakeResponse(429)):
            with pytest.raises(GeminiUnavailable):
                gemini_service.generate("hello", "rules")

        assert len(gemini_service._cooldown_until) == 2

        with patch.object(settings, "GEMINI_API_KEYS", ["key-a", "key-b"]), \
             patch("gemini_service.requests.post",
                   return_value=ok_response(gemini_reply(days=1))) as post:
            gemini_service.generate("hello again", "rules")

        assert len(self.keys_used(post)) == 1

    def test_a_network_failure_tries_the_next_key(self):
        import requests as requests_lib

        with patch.object(settings, "GEMINI_API_KEYS", ["key-a", "key-b"]), \
             patch("gemini_service.requests.post", side_effect=[
                 requests_lib.Timeout("too slow"), ok_response(gemini_reply(days=1))
             ]) as post:
            gemini_service.generate("hello", "rules")

        assert len(self.keys_used(post)) == 2


class TestKeyCollection:
    def test_numbered_spares_are_collected_in_order(self):
        env = {"GEMINI_API_KEY": "first", "GEMINI_API_KEY2": "second", "GEMINI_API_KEY3": "third"}
        with patch.dict("os.environ", env, clear=False):
            assert settings._collect_gemini_keys() == ["first", "second", "third"]

    def test_duplicates_and_blanks_are_dropped(self):
        env = {"GEMINI_API_KEY": "first", "GEMINI_API_KEY2": "  ", "GEMINI_API_KEY3": "first"}
        with patch.dict("os.environ", env, clear=False):
            assert settings._collect_gemini_keys() == ["first"]

    def test_a_comma_separated_key_is_split(self):
        with patch.dict("os.environ", {"GEMINI_API_KEY": "a, b ,c"}, clear=False):
            assert settings._collect_gemini_keys() == ["a", "b", "c"]


# ---------------------------------------------------------------------------
# HTTP endpoint
# ---------------------------------------------------------------------------

class TestEndpoint:
    @pytest.fixture
    def client(self):
        from app import app

        app.config["TESTING"] = True
        with app.test_client() as client:
            yield client

    def test_returns_a_plan(self, client, payload):
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch("gemini_service.requests.post", return_value=ok_response(gemini_reply())):
            response = client.post("/diet-chart/generate", json=payload)

        assert response.status_code == 200
        body = response.get_json()
        assert body["success"] is True
        assert len(body["data"]["days"]) == 2

    def test_missing_targets_is_a_validation_error(self, client, payload):
        del payload["targets"]
        response = client.post("/diet-chart/generate", json=payload)

        assert response.status_code == 400

    def test_missing_dosha_is_a_validation_error(self, client, payload):
        del payload["dosha"]
        response = client.post("/diet-chart/generate", json=payload)

        assert response.status_code == 400

    def test_an_unconfigured_backend_answers_503(self, client, payload):
        # 503 is the frontend's cue to fall back to the FoodOScope path.
        with patch.object(settings, "GEMINI_API_KEYS", []):
            response = client.post("/diet-chart/generate", json=payload)

        assert response.status_code == 503
        assert response.get_json()["success"] is False
