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

@pytest.fixture(autouse=True)
def no_groq_unless_asked(monkeypatch):
    """Groq backs the diet chart up; it stays off unless a test turns it on,
    whatever a local .env holds, so no test can reach the network."""
    monkeypatch.setattr(settings, "GROQ_API_KEYS", [])
    gemini_service._spent_until.clear()
    gemini_service._resolved_model = None
    yield
    gemini_service._spent_until.clear()
    gemini_service._resolved_model = None


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

    def test_liver_is_not_found_inside_slivered_almonds(self):
        # The live failure: a pregnancy chart excludes "liver", the model wrote
        # "slivered almonds", and two of five meals vanished from most days.
        reply = gemini_reply(days=1)
        reply["days"][0]["meals"][0]["ingredients"] = ["semolina", "slivered almonds"]

        plan = self.normalise(reply, excluded=["liver", "raw egg"])

        assert plan["rejectedMeals"] == []
        assert len(plan["days"][0]["meals"]) == 5

    @pytest.mark.parametrize("ingredient, term", [
        ("chicken liver", "liver"),
        ("boiled eggs, sliced", "egg"),
        ("egg, beaten", "egg"),
        ("masala buttermilk", "milk"),
        ("roasted peanuts", "peanut"),
    ])
    def test_an_excluded_term_is_still_caught_at_the_end_of_a_word(self, ingredient, term):
        reply = gemini_reply(days=1)
        reply["days"][0]["meals"][0]["ingredients"] = [ingredient]

        plan = self.normalise(reply, excluded=[term])

        assert len(plan["rejectedMeals"]) == 1
        assert term in plan["rejectedMeals"][0]

    def test_exclusion_checks_the_dish_name_too(self):
        reply = gemini_reply(days=1)
        reply["days"][0]["meals"][0]["recipeTitle"] = "Peanut chutney"
        reply["days"][0]["meals"][0]["ingredients"] = ["chilli"]

        plan = self.normalise(reply)

        assert len(plan["rejectedMeals"]) == 1

    def test_slot_names_are_matched_loosely(self):
        reply = gemini_reply(days=1)
        names = ["Breakfast", "Mid-Morning Snack", "LUNCH", "evening snack", "Dinner"]
        for meal, name in zip(reply["days"][0]["meals"], names):
            meal["mealType"] = name

        plan = self.normalise(reply)

        assert [m["mealType"] for m in plan["days"][0]["meals"]] == [
            "breakfast", "mid_morning", "lunch", "afternoon_snack", "dinner",
        ]

    def test_a_day_with_most_meals_missing_is_dropped(self):
        # Live: a day came back with one meal of five, 588 kcal.
        reply = gemini_reply(days=2)
        reply["days"][1]["meals"] = reply["days"][1]["meals"][:1]

        plan = self.normalise(reply)

        assert [d["dayNumber"] for d in plan["days"]] == [1]

    def test_meals_rejected_for_exclusions_still_count_as_offered(self):
        # The gaps are the doctor's to see, not a reason to lose the day.
        reply = gemini_reply(days=1)
        for meal in reply["days"][0]["meals"][:3]:
            meal["ingredients"] = ["peanut"]

        plan = self.normalise(reply)

        assert len(plan["days"][0]["meals"]) == 2
        assert len(plan["rejectedMeals"]) == 3

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
        lunch_only = [s for s in diet_planner.DEFAULT_MEAL_STRUCTURE if s["mealType"] == "lunch"]

        plan = self.normalise(reply, meal_structure=lunch_only)

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
             patch("gemini_service.requests.post", side_effect=lambda *a, **k: ok_response(gemini_reply(days=1))) as post:
            plan = diet_planner.generate_diet_chart(payload)

        assert [d["dayNumber"] for d in plan["days"]] == list(range(1, diet_planner.MAX_DAYS + 1))
        assert post.call_count == diet_planner.MAX_DAYS  # one day per request

    def test_a_week_is_composed_one_day_per_request_in_parallel(self, payload):
        # Measured live: ~34 s per day, so a week in one request always ran
        # past the 60 s deadline and every chart fell back to the recipes.
        payload["days"] = 7
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch("gemini_service.requests.post", side_effect=lambda *a, **k: ok_response(gemini_reply(days=1))) as post:
            plan = diet_planner.generate_diet_chart(payload)

        prompts = [c.kwargs["json"]["contents"][0]["parts"][0]["text"] for c in post.call_args_list]
        assert len(prompts) == 7
        assert all("Compose a 1-day" in p and "Number this day 1." in p for p in prompts)
        assert sorted(p.split("covers day ")[1].split(" ")[0] for p in prompts) == list("1234567")
        # A different emphasis per day keeps the week varied (five, cycling).
        assert len({p.rsplit("lean towards", 1)[1] for p in prompts}) == len(diet_planner.CHUNK_EMPHASIS)
        assert [d["dayNumber"] for d in plan["days"]] == [1, 2, 3, 4, 5, 6, 7]
        assert [d["dayLabel"] for d in plan["days"]] == [
            "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
        ]
        assert plan["clinicalFocus"] == ["Iron pairings for the anaemia flag"]  # de-duplicated

    def test_an_incomplete_day_is_filled_from_a_complete_one(self, payload):
        payload["days"] = 7
        short = gemini_reply(days=1)
        short["days"][0]["meals"] = short["days"][0]["meals"][:1]

        def reply(*args, **kwargs):
            prompt = kwargs["json"]["contents"][0]["parts"][0]["text"]
            return ok_response(short if "covers day 3 of" in prompt else gemini_reply(days=1))

        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch("gemini_service.requests.post", side_effect=reply):
            plan = diet_planner.generate_diet_chart(payload)

        assert all(len(day["meals"]) == 5 for day in plan["days"])
        assert "Wednesday repeats earlier days" in plan["summary"]

    def test_a_weeks_summary_does_not_call_itself_a_one_day_plan(self, payload):
        payload["days"] = 7
        reply = gemini_reply(days=1)
        reply["summary"] = "This 1-day North Indian plan suits a pitta constitution."
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch("gemini_service.requests.post", return_value=ok_response(reply)):
            plan = diet_planner.generate_diet_chart(payload)

        assert plan["summary"].startswith("This 7-day North Indian plan")

    def test_a_one_day_chart_is_one_request_without_a_week_note(self, payload):
        payload["days"] = 1
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch("gemini_service.requests.post", return_value=ok_response(gemini_reply(days=1))) as post:
            diet_planner.generate_diet_chart(payload)
        assert post.call_count == 1
        prompt = post.call_args.kwargs["json"]["contents"][0]["parts"][0]["text"]
        assert "-day plan; the other days" not in prompt

    def test_a_refused_day_is_filled_from_the_days_that_came_back(self, payload):
        # Seven requests at once can meet Gemini's per-minute limit.
        payload["days"] = 7
        refused = FakeResponse(400, {"error": {"status": "INVALID_ARGUMENT", "message": "bad"}})

        def reply(*args, **kwargs):
            prompt = kwargs["json"]["contents"][0]["parts"][0]["text"]
            failing = "covers day 3 of" in prompt or "covers day 6 of" in prompt
            return refused if failing else ok_response(gemini_reply(days=1))

        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch("gemini_service.requests.post", side_effect=reply):
            plan = diet_planner.generate_diet_chart(payload)

        assert plan["source"] == "gemini"
        assert [d["dayNumber"] for d in plan["days"]] == [1, 2, 3, 4, 5, 6, 7]
        assert all(day["meals"] for day in plan["days"])
        assert "Wednesday, Saturday repeat earlier days" in plan["summary"]

    def test_every_day_failing_fails_the_chart(self, payload):
        payload["days"] = 7
        refused = FakeResponse(400, {"error": {"status": "INVALID_ARGUMENT", "message": "bad"}})
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch("gemini_service.requests.post", return_value=refused):
            with pytest.raises(GeminiUnavailable):
                diet_planner.generate_diet_chart(payload)

    def test_thinking_is_switched_off_inside_generation_config(self, payload):
        # Gemini only knows thinkingConfig as part of generationConfig. Sent at
        # the top level of the request it rejects the whole call with
        # 400 "Unknown name thinkingConfig", and every AI chart fell back to
        # the FoodOScope recipes.
        payload["days"] = 1
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch("gemini_service.requests.post", return_value=ok_response(gemini_reply(days=1))) as post:
            diet_planner.generate_diet_chart(payload)

        sent = post.call_args.kwargs["json"]
        assert "thinkingConfig" not in sent
        assert sent["generationConfig"]["thinkingConfig"] == {"thinkingBudget": 0}

    def test_a_model_that_cannot_switch_thinking_off_is_asked_again_with_it_on(self, payload):
        payload["days"] = 1
        refused = FakeResponse(400, {"error": {
            "status": "INVALID_ARGUMENT",
            "message": "Budget 0 is invalid. This model only works in thinking mode.",
        }})
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch("gemini_service.requests.post",
                   side_effect=[refused, ok_response(gemini_reply(days=1))]) as post:
            plan = diet_planner.generate_diet_chart(payload)

        assert plan["source"] == "gemini"
        first, second = (call.kwargs["json"]["generationConfig"] for call in post.call_args_list)
        assert first["thinkingConfig"] == {"thinkingBudget": 0}
        # Gemini 3 models take a level instead; "low" is the fastest they all accept.
        assert second["thinkingConfig"] == {"thinkingLevel": "low"}

    def test_a_model_that_knows_no_thinking_level_thinks_as_it_likes(self, payload):
        payload["days"] = 1
        no_budget = FakeResponse(400, {"error": {
            "status": "INVALID_ARGUMENT",
            "message": "Budget 0 is invalid. This model only works in thinking mode.",
        }})
        no_level = FakeResponse(400, {"error": {
            "status": "INVALID_ARGUMENT",
            "message": 'Invalid JSON payload received. Unknown name "thinkingLevel"',
        }})
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch("gemini_service.requests.post",
                   side_effect=[no_budget, no_level, ok_response(gemini_reply(days=1))]) as post:
            plan = diet_planner.generate_diet_chart(payload)

        assert plan["source"] == "gemini"
        third = post.call_args_list[2].kwargs["json"]["generationConfig"]
        assert "thinkingConfig" not in third

    def test_an_unrelated_bad_request_is_not_retried(self, payload):
        payload["days"] = 1
        bad = FakeResponse(400, {"error": {
            "status": "INVALID_ARGUMENT", "message": "Request contains an invalid argument.",
        }})
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch("gemini_service.requests.post", return_value=bad) as post:
            with pytest.raises(GeminiUnavailable):
                diet_planner.generate_diet_chart(payload)
        assert post.call_count == 1

    def test_without_a_key_it_is_unavailable(self, payload):
        with patch.object(settings, "GEMINI_API_KEYS", []):
            with pytest.raises(GeminiUnavailable):
                diet_planner.generate_diet_chart(payload)


class TestGroqBackup:
    """Groq writes a day when Gemini cannot.

    Live, Gemini's free tier ran out of its 20 requests a day per model, and
    when it had quota it took over 60 s for one day, so every AI chart fell
    back to the recipe database. Groq answers the same prompt in seconds.
    """

    QUOTA = FakeResponse(429, {"error": {
        "status": "RESOURCE_EXHAUSTED",
        "message": (
            "Quota exceeded for metric: generativelanguage.googleapis.com/"
            "generate_content_free_tier_requests, limit: 20, model: gemini-3.8-flash. "
            "Please retry in 22m39s."
        ),
    }})

    @staticmethod
    def groq_reply(days=1):
        return FakeResponse(200, {"choices": [{"message": {"content": json.dumps(gemini_reply(days=days))}}]})

    def route(self, gemini, groq):
        calls = []

        def fake_post(url, **kwargs):
            if url == gemini_service.GROQ_CHAT_URL:
                calls.append(("groq", kwargs["json"]))
                return groq(kwargs) if callable(groq) else groq
            calls.append(("gemini", kwargs["json"]))
            return gemini(kwargs) if callable(gemini) else gemini

        return calls, fake_post

    def test_groq_writes_the_chart_when_gemini_is_out_of_quota(self, payload):
        payload["days"] = 1
        calls, fake_post = self.route(self.QUOTA, self.groq_reply())
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch.object(settings, "GROQ_API_KEYS", ["groq-key"]), \
             patch("gemini_service.requests.post", side_effect=fake_post):
            plan = diet_planner.generate_diet_chart(payload)

        assert plan["source"] == "gemini"  # still the AI chart, as far as the page is concerned
        assert plan["days"] and all(day["meals"] for day in plan["days"])
        assert plan["model"].startswith("groq/")
        groq_body = [body for name, body in calls if name == "groq"][0]
        assert groq_body["response_format"] == {"type": "json_object"}
        assert groq_body["max_tokens"] <= 2500  # Groq counts it against tokens-per-minute

    def test_a_slow_gemini_leaves_groq_time_to_answer(self, payload):
        payload["days"] = 1
        timeouts = []

        def fake_post(url, **kwargs):
            if url == gemini_service.GROQ_CHAT_URL:
                timeouts.append(("groq", kwargs["timeout"]))
                return self.groq_reply()
            timeouts.append(("gemini", kwargs["timeout"]))
            raise gemini_service.requests.Timeout("read timed out")

        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch.object(settings, "GROQ_API_KEYS", ["groq-key"]), \
             patch("gemini_service.requests.post", side_effect=fake_post):
            plan = diet_planner.generate_diet_chart(payload)

        assert plan["model"].startswith("groq/")
        gemini_wait = max(t for name, t in timeouts if name == "gemini")
        assert gemini_wait <= 60 - gemini_service._GROQ_JSON_RESERVE_SECONDS
        assert timeouts[-1][0] == "groq"

    def test_days_from_both_models_are_named(self, payload):
        payload["days"] = 7

        def gemini(kwargs):
            prompt = kwargs["json"]["contents"][0]["parts"][0]["text"]
            return self.QUOTA if "covers day 2 of" in prompt else ok_response(gemini_reply(days=1))

        calls, fake_post = self.route(gemini, self.groq_reply())
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch.object(settings, "GROQ_API_KEYS", ["groq-key"]), \
             patch.object(gemini_service, "_spent_until", {}), \
             patch.object(gemini_service, "_is_spent", lambda name: False), \
             patch("gemini_service.requests.post", side_effect=fake_post):
            plan = diet_planner.generate_diet_chart(payload)

        assert [d["dayNumber"] for d in plan["days"]] == [1, 2, 3, 4, 5, 6, 7]
        assert "repeat earlier days" not in plan["summary"]
        assert "groq/" in plan["model"] and "gemini" in plan["model"]

    def test_gpt_oss_is_asked_to_reason_briefly(self, payload):
        # At its default effort gpt-oss ran past the time Groq is given.
        payload["days"] = 1
        calls, fake_post = self.route(self.QUOTA, self.groq_reply())
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch.object(settings, "GROQ_API_KEYS", ["groq-key"]), \
             patch.object(gemini_service, "_groq_model_override", "openai/gpt-oss-120b"), \
             patch("gemini_service.requests.post", side_effect=fake_post):
            diet_planner.generate_diet_chart(payload)

        groq_body = [body for name, body in calls if name == "groq"][0]
        assert groq_body["reasoning_effort"] == "low"

    def test_other_groq_models_get_no_reasoning_setting(self, payload):
        payload["days"] = 1
        calls, fake_post = self.route(self.QUOTA, self.groq_reply())
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch.object(settings, "GROQ_API_KEYS", ["groq-key"]), \
             patch.object(gemini_service, "_groq_model_override", "llama-3.3-70b-versatile"), \
             patch("gemini_service.requests.post", side_effect=fake_post):
            diet_planner.generate_diet_chart(payload)

        groq_body = [body for name, body in calls if name == "groq"][0]
        assert "reasoning_effort" not in groq_body

    def test_both_failing_reports_both_reasons(self, payload):
        payload["days"] = 1
        calls, fake_post = self.route(self.QUOTA, FakeResponse(429, {"error": "rate limited"}))
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch.object(settings, "GROQ_API_KEYS", ["groq-key"]), \
             patch("gemini_service.requests.post", side_effect=fake_post):
            with pytest.raises(GeminiUnavailable) as caught:
                diet_planner.generate_diet_chart(payload)

        assert "quota" in str(caught.value).lower() and "Groq" in str(caught.value)

    def test_gemini_answering_leaves_groq_alone(self, payload):
        payload["days"] = 1
        calls, fake_post = self.route(ok_response(gemini_reply(days=1)), self.groq_reply())
        with patch.object(settings, "GEMINI_API_KEYS", ["key-a"]), \
             patch.object(settings, "GROQ_API_KEYS", ["groq-key"]), \
             patch("gemini_service.requests.post", side_effect=fake_post):
            plan = diet_planner.generate_diet_chart(payload)

        assert [name for name, _ in calls] == ["gemini"]
        assert not plan["model"].startswith("groq/")


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
            assert settings._collect_keys("GEMINI_API_KEY") == ["first", "second", "third"]

    def test_duplicates_and_blanks_are_dropped(self):
        env = {"GEMINI_API_KEY": "first", "GEMINI_API_KEY2": "  ", "GEMINI_API_KEY3": "first"}
        with patch.dict("os.environ", env, clear=False):
            assert settings._collect_keys("GEMINI_API_KEY") == ["first"]

    def test_a_comma_separated_key_is_split(self):
        with patch.dict("os.environ", {"GEMINI_API_KEY": "a, b ,c"}, clear=False):
            assert settings._collect_keys("GEMINI_API_KEY") == ["a", "b", "c"]


# ---------------------------------------------------------------------------
# HTTP endpoint
# ---------------------------------------------------------------------------

class TestEndpoint:
    @pytest.fixture(autouse=True)
    def _signed_in(self, signed_in):
        """The route needs a signed-in caller; test_route_auth.py covers the 401."""

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
