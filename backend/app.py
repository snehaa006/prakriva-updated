"""
Enhanced Flask application with comprehensive features and production readiness
"""
import os
import re
import sys
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_caching import Cache
from werkzeug.exceptions import BadRequest, InternalServerError
from werkzeug.middleware.proxy_fix import ProxyFix
from loguru import logger
import traceback

# Import our modules
from config import settings
from models import (
    UserProfile, MealPlanRequest, MealPlanResponse, 
    APIResponse, HealthCheck, DoshaResult
)
from dataset_loader import dataset_loader
from dosha_estimator import dosha_predictor
from calorie_calculator import estimate_calories, get_calorie_breakdown
from planner import meal_planner
from db import db_manager
from disease_detection import (
    SYMPTOMS,
    ScreeningInput,
    available_conditions,
    run_screening,
)
from disease_detection.pipeline import UnknownConditionError
import gemini_service
import diet_planner
import translation_service
from exceptions import (
    AyurvedicPlannerError, ValidationError, ModelError,
    DoshaPredictionError, MealPlanGenerationError, DatabaseError
)



def create_app() -> Flask:
    """Application factory pattern"""
    
    app = Flask(__name__)

    # Render (like any managed host) terminates TLS at its own proxy and
    # forwards the request on, so request.remote_addr is the proxy's address
    # rather than the caller's. get_remote_address keys the rate limiter off
    # that value, so without this every visitor — and Render's health checker —
    # shares a single bucket, and one busy user rate-limits everyone else.
    # Trust exactly one hop: the proxy in front of us sets X-Forwarded-For, and
    # trusting more would let a caller spoof its own address and its own quota.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    # Configure CORS. Exact origins come from settings.ALLOWED_ORIGINS (see
    # config.py — override with the ALLOWED_ORIGINS env var in production).
    # Vercel preview deployments get a new *.vercel.app subdomain per branch/PR,
    # so also allow any origin under vercel.app rather than hardcoding each one.
    vercel_preview_pattern = re.compile(r"^https://[a-z0-9-]+\.vercel\.app$")
    CORS(app, origins=[*settings.ALLOWED_ORIGINS, vercel_preview_pattern])
    
    # Configure rate limiting. storage_uri is passed explicitly (see
    # settings.RATELIMIT_STORAGE_URI) — without it flask-limiter falls back to
    # in-memory storage *and* emits a UserWarning on every boot.
    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        default_limits=[f"{settings.RATE_LIMIT_PER_HOUR} per hour"],
        storage_uri=settings.RATELIMIT_STORAGE_URI,
    )

    if settings.RATELIMIT_STORAGE_URI.startswith("memory://"):
        # Fine for the single-process deployment we run today, but worth
        # saying out loud so it is obvious what to change when scaling out.
        logger.info(
            "Rate limits are counted in process memory. Set RATELIMIT_STORAGE_URI "
            "(or REDIS_URL) to a shared Redis instance before running more than "
            "one worker, otherwise each worker enforces its own separate limit."
        )
    else:
        logger.info(
            f"Rate limit storage: {settings.RATELIMIT_STORAGE_URI.split('://')[0]}://…"
        )
    
    # Configure caching
    cache = Cache(app, config={
        'CACHE_TYPE': settings.CACHE_TYPE,
        'CACHE_DEFAULT_TIMEOUT': settings.CACHE_DEFAULT_TIMEOUT
    })
    
    # Store instances in app context
    app.limiter = limiter
    app.cache = cache
    
    return app


app = create_app()


# Global data loading with caching
@app.cache.memoize(timeout=3600)
def get_datasets():
    """Load and cache datasets"""
    try:
        return dataset_loader.load_all_datasets()
    except Exception as e:
        logger.error(f"Failed to load datasets: {e}")
        raise ModelError(f"Dataset loading failed: {e}")


# Middleware and request handling
@app.before_request
def before_request():
    """Pre-request processing"""
    g.request_start_time = datetime.now(timezone.utc)
    g.request_id = request.headers.get('X-Request-ID', 'unknown')
    
    # Log incoming request
    logger.info(f"Request {g.request_id}: {request.method} {request.path}")


@app.after_request
def after_request(response):
    """Post-request processing"""
    if hasattr(g, 'request_start_time'):
        duration = (datetime.now(timezone.utc) - g.request_start_time).total_seconds()
        logger.info(f"Request {getattr(g, 'request_id', 'unknown')} completed in {duration:.3f}s")
    
    # Add security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    return response


# Error handlers
@app.errorhandler(ValidationError)
def handle_validation_error(e):
    """Handle validation errors"""
    logger.warning(f"Validation error: {e.message}")
    return jsonify(APIResponse(
        success=False,
        error=e.message,
        message="Invalid input data"
    ).dict()), 400


@app.errorhandler(ModelError)
def handle_model_error(e):
    """Handle model-related errors"""
    logger.error(f"Model error: {e.message}")
    return jsonify(APIResponse(
        success=False,
        error="Model processing failed",
        message="Internal model error occurred"
    ).dict()), 500


@app.errorhandler(DatabaseError)
def handle_database_error(e):
    """Handle database errors"""
    logger.error(f"Database error: {e.message}")
    return jsonify(APIResponse(
        success=False,
        error="Database operation failed",
        message="Please try again later"
    ).dict()), 500


@app.errorhandler(AyurvedicPlannerError)
def handle_planner_error(e):
    """Handle general planner errors"""
    logger.error(f"Planner error: {e.message}")
    return jsonify(APIResponse(
        success=False,
        error=e.message,
        message="Meal planning failed"
    ).dict()), 500


@app.errorhandler(400)
def handle_bad_request(e):
    """Handle bad requests"""
    return jsonify(APIResponse(
        success=False,
        error="Bad request",
        message="Invalid request format"
    ).dict()), 400


@app.errorhandler(429)
def handle_rate_limit(e):
    """Handle rate limit exceeded"""
    return jsonify(APIResponse(
        success=False,
        error="Rate limit exceeded",
        message="Too many requests. Please try again later."
    ).dict()), 429


@app.errorhandler(500)
def handle_internal_error(e):
    """Handle internal server errors"""
    logger.error(f"Internal server error: {str(e)}\n{traceback.format_exc()}")
    return jsonify(APIResponse(
        success=False,
        error="Internal server error",
        message="An unexpected error occurred"
    ).dict()), 500


# API Routes
@app.route("/", methods=["GET"])
def index():
    """API root endpoint"""
    return jsonify(APIResponse(
        success=True,
        message="Ayurvedic Meal Planner API is running",
        data={
            "version": settings.MODEL_VERSION,
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    ).dict())


@app.route("/health", methods=["GET"])
@app.limiter.exempt
def health_check():
    """Comprehensive health check endpoint.

    Exempt from rate limiting. Render polls this path every few seconds, which
    is well over the 500/hour default limit, so the probe used to start getting
    429s partway through each hour. Render reads any non-2xx as the instance
    being unavailable, so the limiter was reporting a healthy service as failed
    and getting it restarted. A liveness probe must never be rate limited.
    """
    try:
        # Check database
        db_status = db_manager.health_check()
        
        # Check datasets
        try:
            datasets = get_datasets()
            dataset_status = {
                "status": "healthy",
                "datasets_loaded": len(datasets),
                "total_foods": len(datasets.get('food', [])) if datasets.get('food') is not None else 0
            }
        except Exception as e:
            dataset_status = {
                "status": "error",
                "message": str(e)
            }
        
        # Check ML model
        ml_status = {
            "status": "healthy" if dosha_predictor.ml_model is not None else "warning",
            "model_loaded": dosha_predictor.ml_model is not None
        }
        
        health_data = HealthCheck(
            status="healthy",
            version=settings.MODEL_VERSION,
            timestamp=datetime.now(timezone.utc).isoformat(),
            dependencies={
                "database": db_status.get("status", "unknown"),
                "datasets": dataset_status.get("status", "unknown"),
                "ml_model": ml_status.get("status", "unknown")
            }
        )
        
        return jsonify(APIResponse(
            success=True,
            data=health_data.dict(),
            message="Health check completed"
        ).dict())
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify(APIResponse(
            success=False,
            error="Health check failed",
            message=str(e)
        ).dict()), 500


@app.route("/generate", methods=["POST"])
@app.limiter.limit(f"{settings.RATE_LIMIT_PER_MINUTE} per minute")
def generate_meal_plan():
    """
    Generate personalized meal plan
    Enhanced version with comprehensive validation and error handling
    """
    try:
        # Validate request content type
        if not request.is_json:
            raise ValidationError("Content-Type must be application/json")
        
        # Parse and validate request
        try:
            request_data = MealPlanRequest(**request.json)
        except Exception as e:
            raise ValidationError(f"Invalid request format: {str(e)}")
        
        user_profile = request_data.user_profile
        days = request_data.days
        model_name = request_data.model
        preferences = request_data.preferences or {}
        
        logger.info(f"Generating meal plan for user: {days} days, model: {model_name}")
        
        # Load datasets
        try:
            datasets = get_datasets()
            food_df = datasets["food"]
            dosha_df = datasets.get("dosha")
        except Exception as e:
            raise ModelError(f"Failed to load datasets: {e}")
        
        # Step 1: Predict dosha using hybrid approach
        try:
            dosha_result = dosha_predictor.predict_dosha_hybrid(
                user_profile, 
                dosha_df, 
                model_name
            )
            logger.info(f"Dosha prediction: {dosha_result.dosha} (confidence: {dosha_result.confidence:.2f})")
        except Exception as e:
            logger.warning(f"Dosha prediction failed, using fallback: {e}")
            dosha_result = DoshaResult(
                dosha="vata",
                scores={"vata": 0.4, "pitta": 0.3, "kapha": 0.3},
                confidence=0.3,
                method="fallback"
            )
        
        # Step 2: Calculate calories with detailed breakdown
        try:
            calorie_breakdown = get_calorie_breakdown(user_profile)
            daily_calories = calorie_breakdown["target_calories"]
            logger.info(f"Calculated daily calories: {daily_calories}")
        except Exception as e:
            logger.warning(f"Calorie calculation failed, using fallback: {e}")
            daily_calories = estimate_calories(user_profile)
            calorie_breakdown = {"target_calories": daily_calories}
        
        # Step 3: Generate meal plan
        try:
            plan = meal_planner.generate_meal_plan_advanced(
                user_profile=user_profile,
                food_df=food_df,
                dosha_info=dosha_result,
                daily_calories=daily_calories,
                days=days,
                model=model_name,
                preferences=preferences
            )
            logger.success("Meal plan generated successfully")
        except Exception as e:
            logger.error(f"Meal plan generation failed: {e}")
            raise MealPlanGenerationError(f"Failed to generate meal plan: {e}")
        
        # Step 4: Save plan to database
        doc_id = None
        try:
            save_payload = {
                "user_profile": user_profile.dict(),
                "dosha_result": dosha_result.dict(),
                "daily_calories": daily_calories,
                "calorie_breakdown": calorie_breakdown,
                "plan": plan,
                "generation_params": {
                    "days": days,
                    "model": model_name,
                    "preferences": preferences
                }
            }
            
            metadata = {
                "generation_method": "hybrid_llm_ml",
                "api_version": settings.MODEL_VERSION,
                "request_id": getattr(g, 'request_id', 'unknown')
            }
            
            doc_id = db_manager.save_generated_plan(
                user_id=user_profile.Patient_ID or "anonymous",
                payload=save_payload,
                metadata=metadata
            )
            logger.success(f"Plan saved with ID: {doc_id}")
            
        except Exception as e:
            logger.warning(f"Failed to save plan: {e}")
            # Continue without failing the request
        
        # Step 5: Prepare response
        response_data = MealPlanResponse(
            plan=plan,
            dosha=dosha_result,
            daily_calories=int(daily_calories),
            plan_id=doc_id,
            metadata={
                "generation_time": datetime.now(timezone.utc).isoformat(),
                "model_used": model_name,
                "method": dosha_result.method,
                "calorie_breakdown": calorie_breakdown
            }
        )
        
        return jsonify(APIResponse(
            success=True,
            data=response_data.dict(),
            message="Meal plan generated successfully"
        ).dict())
        
    except ValidationError as e:
        raise e  # Let error handler deal with it
    except (ModelError, DoshaPredictionError, MealPlanGenerationError) as e:
        raise e  # Let error handler deal with it
    except Exception as e:
        logger.error(f"Unexpected error in meal plan generation: {e}\n{traceback.format_exc()}")
        raise AyurvedicPlannerError(f"Meal plan generation failed: {str(e)}")


@app.route("/diet-chart/generate", methods=["POST"])
@app.limiter.limit("30 per hour")
def generate_diet_chart():
    """Compose a diet chart with Gemini from the context the frontend holds.

    Body: the profile summary, the already-determined dosha, the clinical
    targets, the exclude/focus ingredient lists, the patient's pantry and her
    recent disease screenings — see `diet_planner.build_diet_prompt`. Nothing
    identifying is required or used, and no patient lookup happens here: the
    caller passes in exactly the rows it is already allowed to read.

    Returns 503 when Gemini is unconfigured or every key failed, which is the
    frontend's cue to fall back to the FoodOScope recipe path.
    """
    try:
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            raise ValidationError("Request body must be a JSON object")

        targets = payload.get("targets")
        if not isinstance(targets, dict) or not isinstance(targets.get("calories"), dict):
            raise ValidationError("Nutritional targets are required")

        dosha = payload.get("dosha")
        if not isinstance(dosha, dict) or not dosha.get("primary"):
            raise ValidationError("A determined dosha is required")

        plan = diet_planner.generate_diet_chart(payload)

        return jsonify(APIResponse(
            success=True,
            data={**plan, "model": gemini_service.active_model()},
            message="Diet chart generated successfully",
        ).dict())
    except ValidationError:
        raise
    except gemini_service.GeminiUnavailable as e:
        logger.warning(f"Gemini diet chart unavailable: {e}")
        return jsonify(APIResponse(
            success=False, error=str(e), message="Diet chart generation unavailable"
        ).dict()), 503
    except Exception as e:
        logger.error(f"Diet chart generation failed: {e}")
        raise MealPlanGenerationError(f"Diet chart generation failed: {e}")


@app.route("/plan/<plan_id>", methods=["GET"])
@app.limiter.limit("60 per minute")
def get_meal_plan(plan_id: str):
    """Get a specific meal plan by ID"""
    try:
        plan = db_manager.get_generated_plan(plan_id)
        
        if not plan:
            return jsonify(APIResponse(
                success=False,
                error="Plan not found",
                message=f"No meal plan found with ID: {plan_id}"
            ).dict()), 404
        
        return jsonify(APIResponse(
            success=True,
            data=plan,
            message="Meal plan retrieved successfully"
        ).dict())
        
    except DatabaseError as e:
        raise e
    except Exception as e:
        logger.error(f"Failed to get meal plan {plan_id}: {e}")
        raise DatabaseError(f"Failed to retrieve meal plan: {e}")


@app.route("/user/<user_id>/plans", methods=["GET"])
@app.limiter.limit("30 per minute")
def get_user_meal_plans(user_id: str):
    """Get all meal plans for a specific user"""
    try:
        limit = min(int(request.args.get('limit', 10)), 50)  # Max 50
        status = request.args.get('status', 'active')
        
        plans = db_manager.get_user_plans(user_id, limit, status)
        
        return jsonify(APIResponse(
            success=True,
            data={
                "plans": plans,
                "total": len(plans),
                "user_id": user_id,
                "status": status
            },
            message=f"Retrieved {len(plans)} meal plans"
        ).dict())
        
    except DatabaseError as e:
        raise e
    except Exception as e:
        logger.error(f"Failed to get user plans for {user_id}: {e}")
        raise DatabaseError(f"Failed to retrieve user plans: {e}")


@app.route("/plan/<plan_id>/edit", methods=["POST"])
@app.limiter.limit("10 per minute")
def edit_meal_plan(plan_id: str):
    """Allow doctors to edit meal plans"""
    try:
        if not request.is_json:
            raise ValidationError("Content-Type must be application/json")
        
        data = request.json
        doctor_id = data.get('doctor_id')
        edited_plan = data.get('edited_plan')
        reason = data.get('reason', '')
        edit_type = data.get('edit_type', 'modification')
        
        if not doctor_id:
            raise ValidationError("doctor_id is required")
        
        if not edited_plan:
            raise ValidationError("edited_plan is required")
        
        # Save the edit
        edit_id = db_manager.save_doctor_edit(
            plan_id=plan_id,
            doctor_id=doctor_id,
            edited_plan=edited_plan,
            reason=reason,
            edit_type=edit_type
        )
        
        return jsonify(APIResponse(
            success=True,
            data={"edit_id": edit_id, "plan_id": plan_id},
            message="Meal plan edited successfully"
        ).dict())
        
    except ValidationError as e:
        raise e
    except DatabaseError as e:
        raise e
    except Exception as e:
        logger.error(f"Failed to edit meal plan {plan_id}: {e}")
        raise DatabaseError(f"Failed to edit meal plan: {e}")


@app.route("/plan/<plan_id>/edits", methods=["GET"])
@app.limiter.limit("30 per minute")
def get_plan_edits(plan_id: str):
    """Get all edits for a specific meal plan"""
    try:
        edits = db_manager.get_plan_edits(plan_id)
        
        return jsonify(APIResponse(
            success=True,
            data={
                "edits": edits,
                "total": len(edits),
                "plan_id": plan_id
            },
            message=f"Retrieved {len(edits)} edits"
        ).dict())
        
    except DatabaseError as e:
        raise e
    except Exception as e:
        logger.error(f"Failed to get edits for plan {plan_id}: {e}")
        raise DatabaseError(f"Failed to retrieve edits: {e}")


@app.route("/plan/<plan_id>/feedback", methods=["POST"])
@app.limiter.limit("5 per minute")
def submit_feedback(plan_id: str):
    """Submit user feedback for a meal plan"""
    try:
        if not request.is_json:
            raise ValidationError("Content-Type must be application/json")
        
        data = request.json
        user_id = data.get('user_id')
        rating = data.get('rating')
        feedback = data.get('feedback', '')
        categories = data.get('categories', [])
        
        if not user_id:
            raise ValidationError("user_id is required")
        
        if not isinstance(rating, int) or rating < 1 or rating > 5:
            raise ValidationError("rating must be an integer between 1 and 5")
        
        feedback_id = db_manager.save_user_feedback(
            plan_id=plan_id,
            user_id=user_id,
            rating=rating,
            feedback=feedback,
            categories=categories
        )
        
        return jsonify(APIResponse(
            success=True,
            data={"feedback_id": feedback_id, "plan_id": plan_id},
            message="Feedback submitted successfully"
        ).dict())
        
    except ValidationError as e:
        raise e
    except DatabaseError as e:
        raise e
    except Exception as e:
        logger.error(f"Failed to submit feedback for plan {plan_id}: {e}")
        raise DatabaseError(f"Failed to submit feedback: {e}")


@app.route("/dosha/predict", methods=["POST"])
@app.limiter.limit("20 per minute")
def predict_dosha_only():
    """Standalone dosha prediction endpoint"""
    try:
        if not request.is_json:
            raise ValidationError("Content-Type must be application/json")
        
        try:
            user_profile = UserProfile(**request.json)
        except Exception as e:
            raise ValidationError(f"Invalid user profile: {str(e)}")
        
        # Load dosha dataset
        try:
            datasets = get_datasets()
            dosha_df = datasets.get("dosha")
        except Exception as e:
            logger.warning(f"Failed to load dosha dataset: {e}")
            dosha_df = None
        
        # Predict dosha
        dosha_result = dosha_predictor.predict_dosha_hybrid(
            user_profile, 
            dosha_df, 
            request.json.get('model', settings.DEFAULT_MODEL)
        )
        
        return jsonify(APIResponse(
            success=True,
            data=dosha_result.dict(),
            message="Dosha predicted successfully"
        ).dict())
        
    except ValidationError as e:
        raise e
    except DoshaPredictionError as e:
        raise e
    except Exception as e:
        logger.error(f"Dosha prediction failed: {e}")
        raise DoshaPredictionError(f"Dosha prediction failed: {e}")


@app.route("/calories/calculate", methods=["POST"])
@app.limiter.limit("30 per minute")
def calculate_calories():
    """Standalone calorie calculation endpoint"""
    try:
        if not request.is_json:
            raise ValidationError("Content-Type must be application/json")
        
        try:
            user_profile = UserProfile(**request.json)
        except Exception as e:
            raise ValidationError(f"Invalid user profile: {str(e)}")
        
        # Calculate calories with breakdown
        calorie_data = get_calorie_breakdown(user_profile)
        
        return jsonify(APIResponse(
            success=True,
            data=calorie_data,
            message="Calories calculated successfully"
        ).dict())
        
    except ValidationError as e:
        raise e
    except Exception as e:
        logger.error(f"Calorie calculation failed: {e}")
        raise AyurvedicPlannerError(f"Calorie calculation failed: {e}")


@app.route("/disease/conditions", methods=["GET"])
@app.limiter.limit("60 per minute")
def list_disease_conditions():
    """Conditions the screening pipeline covers, plus the symptom vocabulary.

    The frontend builds its screening form from this, so adding a condition or
    a symptom on the backend does not need a matching frontend release.
    """
    try:
        return jsonify(APIResponse(
            success=True,
            data={
                "conditions": available_conditions(),
                "symptoms": [
                    {"key": key, "label": label} for key, label in SYMPTOMS.items()
                ],
            },
            message="Disease detection metadata retrieved successfully"
        ).dict())

    except Exception as e:
        logger.error(f"Failed to list disease conditions: {e}")
        raise ModelError(f"Failed to list disease conditions: {e}")


@app.route("/disease/screen", methods=["POST"])
@app.limiter.limit("30 per minute")
def screen_diseases():
    """Run the maternal disease detection pipeline for one patient.

    Body is a `ScreeningInput` payload, optionally with a `conditions` list to
    restrict the run to a subset.
    """
    try:
        if not request.is_json:
            raise ValidationError("Content-Type must be application/json")

        payload = dict(request.json or {})
        conditions = payload.pop("conditions", None)
        if conditions is not None and not isinstance(conditions, list):
            raise ValidationError("'conditions' must be a list of condition keys")

        try:
            screening_input = ScreeningInput(**payload)
        except ValidationError:
            raise
        except Exception as e:
            raise ValidationError(f"Invalid screening input: {str(e)}")

        try:
            result = run_screening(screening_input, conditions)
        except UnknownConditionError as e:
            raise ValidationError(str(e))

        logger.info(
            f"Screening completed: overall={result.overall_risk_level.value}, "
            f"top={result.highest_risk_condition}"
        )

        return jsonify(APIResponse(
            success=True,
            data=result.dict(),
            message="Disease screening completed successfully"
        ).dict())

    except ValidationError as e:
        raise e
    except Exception as e:
        logger.error(f"Disease screening failed: {e}")
        raise ModelError(f"Disease screening failed: {e}")


@app.route("/analysis/status", methods=["GET"])
def analysis_status():
    """Whether the Gemini-backed analysis features are configured.

    The frontend uses this to hide the AI panels entirely rather than offering
    a button that can only fail.
    """
    return jsonify(APIResponse(
        success=True,
        data={
            "enabled": gemini_service.is_configured(),
            # Which model the backend will actually call. Reported because a
            # retired model ID looks exactly like a broken key from the
            # frontend, and this is the cheapest way to tell them apart.
            "model": gemini_service.active_model(),
        },
        message="Analysis availability retrieved",
    ).dict())


@app.route("/analysis/screening", methods=["POST"])
@app.limiter.limit("20 per hour")
def analyse_screenings():
    """Narrative clinical read of a patient's screening history.

    Body: `{"screenings": [...], "range_label": "the last 30 days"}` — the same
    stored screening objects the frontend already holds, so no patient lookup
    happens here and no identifiers are needed.
    """
    try:
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            raise ValidationError("Request body must be a JSON object")

        screenings = payload.get("screenings")
        if not isinstance(screenings, list) or not screenings:
            raise ValidationError("At least one screening is required")

        prompt = gemini_service.build_clinician_prompt(
            screenings, str(payload.get("range_label") or "the recorded period")
        )
        analysis = gemini_service.generate(prompt, gemini_service.CLINICIAN_RULES)

        return jsonify(APIResponse(
            success=True,
            data={"analysis": analysis, "model": gemini_service.active_model()},
            message="Analysis generated successfully",
        ).dict())
    except ValidationError:
        raise
    except gemini_service.GeminiUnavailable as e:
        logger.warning(f"Gemini analysis unavailable: {e}")
        return jsonify(APIResponse(
            success=False, error=str(e), message="Analysis unavailable"
        ).dict()), 503
    except Exception as e:
        logger.error(f"Screening analysis failed: {e}")
        raise ModelError(f"Screening analysis failed: {e}")


@app.route("/assistant/ask", methods=["POST"])
@app.limiter.limit("30 per hour")
def assistant_ask():
    """Answer a patient's question about her own screening results.

    Body: `{"question": "...", "screenings": [...]}`. The screenings are passed
    in by the caller, so this endpoint never reads another patient's data.
    """
    try:
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            raise ValidationError("Request body must be a JSON object")

        question = str(payload.get("question") or "").strip()
        if not question:
            raise ValidationError("A question is required")
        if len(question) > 1000:
            raise ValidationError("Question is too long")

        screenings = payload.get("screenings")
        if not isinstance(screenings, list):
            screenings = []

        prompt = gemini_service.build_patient_prompt(question, screenings)
        answer = gemini_service.generate(
            prompt, gemini_service.PATIENT_RULES, max_tokens=1200
        )

        return jsonify(APIResponse(
            success=True,
            data={"answer": answer},
            message="Answer generated successfully",
        ).dict())
    except ValidationError:
        raise
    except gemini_service.GeminiUnavailable as e:
        logger.warning(f"Gemini assistant unavailable: {e}")
        return jsonify(APIResponse(
            success=False, error=str(e), message="Assistant unavailable"
        ).dict()), 503
    except Exception as e:
        logger.error(f"Assistant question failed: {e}")
        raise ModelError(f"Assistant question failed: {e}")


#: Turns kept per request — enough for a real back-and-forth (e.g. "do you
#: have cardamom?" / "yes" / <recipe>) without the payload growing unbounded.
_MAX_CHAT_HISTORY_TURNS = 12
_MAX_CHAT_MESSAGE_CHARS = 2000


@app.route("/assistant/chat", methods=["POST"])
@app.limiter.limit("60 per hour")
def assistant_chat():
    """Open-ended chat with the patient's full context, not just screenings.

    Body: `{"message": "...", "history": [{"role": "user"|"model", "text":
    "..."}, ...], "context": {...}}`. As with `/assistant/ask`, the caller —
    already scoped by Supabase RLS to her own rows — assembles and passes in
    everything (profile, active diet plan, pantry, tracking history,
    screenings, optional FoodOScope recipe candidates); this endpoint never
    looks up a patient itself, so it cannot leak another patient's data.
    """
    try:
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            raise ValidationError("Request body must be a JSON object")

        message = str(payload.get("message") or "").strip()
        if not message:
            raise ValidationError("A message is required")
        if len(message) > _MAX_CHAT_MESSAGE_CHARS:
            raise ValidationError("Message is too long")

        history = []
        raw_history = payload.get("history")
        if isinstance(raw_history, list):
            for turn in raw_history[-_MAX_CHAT_HISTORY_TURNS:]:
                if not isinstance(turn, dict):
                    continue
                role = turn.get("role")
                text = str(turn.get("text") or "").strip()
                if role in ("user", "model") and text:
                    history.append({"role": role, "text": text[:_MAX_CHAT_MESSAGE_CHARS]})

        context = payload.get("context")
        if not isinstance(context, dict):
            context = {}

        prompt = gemini_service.build_chat_prompt(message, context)
        # The budget covers the model's internal reasoning as well as the
        # reply, so it is well above what a few short paragraphs need — too
        # tight and the whole budget goes on thinking and the patient gets an
        # empty answer.
        answer = gemini_service.generate(
            prompt, gemini_service.CHAT_RULES, max_tokens=1500, history=history
        )

        return jsonify(APIResponse(
            success=True,
            data={"answer": answer},
            message="Answer generated successfully",
        ).dict())
    except ValidationError:
        raise
    except gemini_service.GeminiUnavailable as e:
        logger.warning(f"Gemini chat unavailable: {e}")
        return jsonify(APIResponse(
            success=False, error=str(e), message="Assistant unavailable"
        ).dict()), 503
    except Exception as e:
        logger.error(f"Assistant chat failed: {e}")
        raise ModelError(f"Assistant chat failed: {e}")


#: Report uploads are photos or scans; anything else is a mistake or an attack.
_ALLOWED_REPORT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic",
                         "image/heif", "application/pdf"}
#: ~8 MB of base64, comfortably above a phone photo and below anything abusive.
_MAX_REPORT_BASE64_CHARS = 11_000_000


@app.route("/analysis/extract-report", methods=["POST"])
@app.limiter.limit("20 per hour")
def extract_report():
    """Read lab values off a photographed or scanned report.

    Body: `{"image": "<base64>", "mime_type": "image/jpeg"}`. Returns only the
    fields the screening form uses, and only those that read as clinically
    plausible — the caller is expected to show them for confirmation rather
    than apply them silently.
    """
    try:
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            raise ValidationError("Request body must be a JSON object")

        image = payload.get("image")
        mime_type = str(payload.get("mime_type") or "").lower()

        if not isinstance(image, str) or not image:
            raise ValidationError("An image is required")
        if len(image) > _MAX_REPORT_BASE64_CHARS:
            raise ValidationError("That file is too large — try a photo under 8 MB")
        if mime_type not in _ALLOWED_REPORT_TYPES:
            raise ValidationError(
                "Upload a photo (JPEG, PNG, WEBP, HEIC) or a PDF of the report"
            )

        values = gemini_service.extract_report_values(image, mime_type)

        return jsonify(APIResponse(
            success=True,
            data={"values": values},
            message=(
                f"Read {len(values)} value(s) from the report"
                if values
                else "No recognisable values were found"
            ),
        ).dict())
    except ValidationError:
        raise
    except gemini_service.GeminiUnavailable as e:
        logger.warning(f"Report extraction unavailable: {e}")
        return jsonify(APIResponse(
            success=False, error=str(e), message="Report reading unavailable"
        ).dict()), 503
    except Exception as e:
        logger.error(f"Report extraction failed: {e}")
        raise ModelError(f"Report extraction failed: {e}")


#: Skin check-ins are phone photos; a PDF makes no sense here, unlike a report.
_ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic",
                        "image/heif"}


@app.route("/analysis/acne-photo", methods=["POST"])
@app.limiter.limit("20 per hour")
def assess_acne_photo():
    """Describe the acne visible in a skin photo, for the PCOD/PCOS tracker.

    Body: `{"image": "<base64>", "mime_type": "image/jpeg"}`. Returns a
    severity band, the visible regions and a short description — never a
    diagnosis and never treatment advice. The photo is forwarded to Gemini and
    discarded; the copy the patient keeps lives in her own Supabase storage
    folder, which this endpoint never touches.

    A photo Gemini cannot judge comes back with `severity: null` rather than a
    guess, so the frontend keeps the patient's own rating instead.
    """
    try:
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            raise ValidationError("Request body must be a JSON object")

        image = payload.get("image")
        mime_type = str(payload.get("mime_type") or "").lower()

        if not isinstance(image, str) or not image:
            raise ValidationError("An image is required")
        if len(image) > _MAX_REPORT_BASE64_CHARS:
            raise ValidationError("That photo is too large — try one under 8 MB")
        if mime_type not in _ALLOWED_PHOTO_TYPES:
            raise ValidationError("Upload a photo (JPEG, PNG, WEBP or HEIC)")

        assessment = gemini_service.assess_acne_photo(image, mime_type)

        return jsonify(APIResponse(
            success=True,
            data=assessment,
            message=(
                "Photo assessed"
                if assessment.get("severity")
                else "Could not judge this photo"
            ),
        ).dict())
    except ValidationError:
        raise
    except gemini_service.GeminiUnavailable as e:
        logger.warning(f"Acne photo assessment unavailable: {e}")
        return jsonify(APIResponse(
            success=False, error=str(e), message="Photo assessment unavailable"
        ).dict()), 503
    except Exception as e:
        logger.error(f"Acne photo assessment failed: {e}")
        raise ModelError(f"Acne photo assessment failed: {e}")


@app.route("/translate", methods=["POST"])
@app.limiter.limit("120 per minute")
def translate_texts():
    """Machine-translate UI strings.

    The frontend translates the page in the browser, calling Google's public
    translate endpoint directly — it is CORS-enabled, so no backend is needed
    for that. This endpoint is the fallback for networks that block it (some
    campus and corporate proxies do), so a user on such a network still gets a
    translated site instead of a silent failure.

    Body: {"texts": ["...", ...], "target": "hi", "source": "en"}
    Returns: {"translations": ["...", ...]} — same order, same length.
    Anything that could not be translated comes back as its own source string,
    so the caller never has to reason about holes in the array.
    """
    try:
        if not request.is_json:
            raise ValidationError("Content-Type must be application/json")

        payload = request.json or {}
        texts = payload.get("texts")
        target = payload.get("target")
        source = payload.get("source", "en")

        if not isinstance(texts, list) or not texts:
            raise ValidationError("`texts` must be a non-empty array of strings")
        if len(texts) > 200:
            raise ValidationError("`texts` may hold at most 200 strings per request")
        if not isinstance(target, str) or not re.fullmatch(r"[A-Za-z]{2,3}(-[A-Za-z]{2,4})?", target):
            raise ValidationError("`target` must be a language code, e.g. 'hi'")
        if not isinstance(source, str) or not re.fullmatch(r"[A-Za-z]{2,3}(-[A-Za-z]{2,4})?", source):
            raise ValidationError("`source` must be a language code, e.g. 'en'")

        cleaned = []
        for text in texts:
            if not isinstance(text, str):
                raise ValidationError("`texts` must hold strings only")
            # Newlines are the record separator downstream, so they cannot
            # survive inside a record.
            cleaned.append(" ".join(text.split())[:2000])

        translations = translation_service.translate_batch(cleaned, target, source)

        return jsonify({"translations": translations})

    except ValidationError:
        raise
    except Exception as e:
        logger.error(f"Translation failed: {e}")
        raise AyurvedicPlannerError(f"Translation failed: {e}")


@app.route("/analytics", methods=["GET"])
@app.limiter.limit("10 per minute")
def get_analytics():
    """Get analytics data (admin endpoint)"""
    try:
        # In production, add authentication check here
        
        limit = min(int(request.args.get('limit', 1000)), 5000)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Parse dates if provided
        start_dt = datetime.fromisoformat(start_date) if start_date else None
        end_dt = datetime.fromisoformat(end_date) if end_date else None
        
        analytics = db_manager.get_analytics_data(start_dt, end_dt, limit)
        
        return jsonify(APIResponse(
            success=True,
            data=analytics,
            message="Analytics data retrieved successfully"
        ).dict())
        
    except ValueError as e:
        raise ValidationError(f"Invalid date format: {e}")
    except DatabaseError as e:
        raise e
    except Exception as e:
        logger.error(f"Analytics retrieval failed: {e}")
        raise DatabaseError(f"Failed to retrieve analytics: {e}")


@app.route("/datasets/info", methods=["GET"])
@app.limiter.limit("20 per minute")
def get_dataset_info():
    """Get information about loaded datasets"""
    try:
        info = dataset_loader.get_dataset_info()
        
        return jsonify(APIResponse(
            success=True,
            data=info,
            message="Dataset information retrieved successfully"
        ).dict())
        
    except Exception as e:
        logger.error(f"Failed to get dataset info: {e}")
        raise ModelError(f"Failed to retrieve dataset information: {e}")


# Utility endpoints for testing
@app.route("/test/validate", methods=["POST"])
@app.limiter.limit("10 per minute")
def test_validation():
    """Test endpoint for request validation"""
    try:
        if not request.is_json:
            raise ValidationError("Content-Type must be application/json")
        
        # Try to validate as UserProfile
        user_profile = UserProfile(**request.json)
        
        return jsonify(APIResponse(
            success=True,
            data=user_profile.dict(),
            message="Validation successful"
        ).dict())
        
    except ValidationError as e:
        raise e
    except Exception as e:
        raise ValidationError(f"Validation failed: {str(e)}")


# Development/Debug endpoints (disable in production)
if settings.FLASK_ENV == "development":
    
    @app.route("/debug/error", methods=["GET"])
    def debug_error():
        """Test error handling"""
        error_type = request.args.get('type', 'general')
        
        if error_type == 'validation':
            raise ValidationError("Test validation error")
        elif error_type == 'model':
            raise ModelError("Test model error")
        elif error_type == 'database':
            raise DatabaseError("Test database error")
        else:
            raise Exception("Test general error")
    
    @app.route("/debug/cache", methods=["GET"])
    def debug_cache():
        """Test caching system"""
        cache_key = request.args.get('key', 'test')
        
        # Try to get from cache
        value = app.cache.get(cache_key)
        
        if value is None:
            value = f"Generated at {datetime.now().isoformat()}"
            app.cache.set(cache_key, value, timeout=60)
            cache_hit = False
        else:
            cache_hit = True
        
        return jsonify({
            "cache_key": cache_key,
            "value": value,
            "cache_hit": cache_hit
        })


if __name__ == "__main__":
    try:
        # Validate configuration
        logger.info("Starting Ayurvedic Meal Planner API...")
        logger.info(f"Environment: {settings.FLASK_ENV}")
        logger.info(f"Debug: {settings.DEBUG}")
        logger.info(f"Port: {settings.PORT}")
        
        # Test critical components
        logger.info("Testing critical components...")
        
        # Test database
        db_health = db_manager.health_check()
        logger.info(f"Database status: {db_health.get('status', 'unknown')}")
        
        # Test dataset loading
        try:
            datasets = get_datasets()
            logger.success(f"Datasets loaded: {list(datasets.keys())}")
        except Exception as e:
            logger.warning(f"Dataset loading failed: {e}")
        
        # Test ML model
        if dosha_predictor.ml_model:
            logger.success("ML model loaded successfully")
        else:
            logger.warning("ML model not loaded")
        
        # Start the application
        logger.success("All components initialized successfully")
        
        app.run(
            host=settings.HOST,
            port=settings.PORT,
            debug=settings.DEBUG,
            threaded=True
        )
        
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        logger.error(traceback.format_exc())
        sys.exit(1)
