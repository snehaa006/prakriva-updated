"""
Enhanced database layer with comprehensive error handling and retry logic.

Backed by Supabase (Postgres). The service-role key is used here, which
bypasses RLS — this module must only ever run server-side.
"""
import time
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from loguru import logger

from postgrest.exceptions import APIError
from supabase import Client, create_client

from config import settings
from exceptions import DatabaseError


def _now_iso() -> str:
    """Timestamp for columns Postgres does not default for us."""
    return datetime.now(timezone.utc).isoformat()


class SupabaseManager:
    """Supabase-backed database manager"""

    def __init__(self):
        self.db: Optional[Client] = None
        self._initialize_client()

    def _initialize_client(self) -> None:
        """Create the Supabase client with proper error handling"""
        try:
            if not settings.SUPABASE_URL:
                raise DatabaseError(
                    "SUPABASE_URL is not configured",
                    "CREDENTIALS_NOT_FOUND"
                )
            if not settings.SUPABASE_SERVICE_ROLE_KEY:
                raise DatabaseError(
                    "SUPABASE_SERVICE_ROLE_KEY is not configured",
                    "CREDENTIALS_NOT_FOUND"
                )

            self.db = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_SERVICE_ROLE_KEY,
            )
            logger.success("Supabase client initialized successfully")

        except DatabaseError:
            raise
        except Exception as e:
            logger.error(f"Supabase initialization failed: {e}")
            raise DatabaseError(f"Failed to initialize Supabase: {e}", "INIT_FAILED")

    def _require_db(self) -> Client:
        if not self.db:
            raise DatabaseError("Database not initialized", "DB_NOT_INITIALIZED")
        return self.db

    def _retry_operation(self, operation, max_retries: int = 3, delay: float = 1.0):
        """Retry database operations with exponential backoff"""
        for attempt in range(max_retries):
            try:
                return operation()
            except Exception as e:
                if attempt == max_retries - 1:
                    raise e

                wait_time = delay * (2 ** attempt)
                logger.warning(
                    f"Database operation failed (attempt {attempt + 1}), "
                    f"retrying in {wait_time}s: {e}"
                )
                time.sleep(wait_time)

    def save_generated_plan(
        self,
        user_id: str,
        payload: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Save generated meal plan with enhanced metadata
        """
        try:
            db = self._require_db()

            def _save_operation():
                row = {
                    "user_id": str(user_id),
                    "payload": payload,
                    "version": settings.MODEL_VERSION,
                    "status": "active",
                }

                if metadata:
                    row["metadata"] = metadata

                if "plan" in payload:
                    row["statistics"] = self._calculate_plan_statistics(payload["plan"])

                result = db.table(settings.GENERATED_PLANS_TABLE).insert(row).execute()
                return result.data[0]["id"]

            plan_id = self._retry_operation(_save_operation)
            logger.success(f"Saved meal plan with ID: {plan_id}")
            return plan_id

        except Exception as e:
            logger.error(f"Failed to save meal plan: {e}")
            raise DatabaseError(f"Failed to save meal plan: {e}", "SAVE_FAILED")

    def get_generated_plan(self, plan_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a generated meal plan by ID
        """
        try:
            db = self._require_db()

            def _get_operation():
                result = (db.table(settings.GENERATED_PLANS_TABLE)
                          .select("*")
                          .eq("id", str(plan_id))
                          .limit(1)
                          .execute())
                return result.data[0] if result.data else None

            result = self._retry_operation(_get_operation)

            if result:
                logger.info(f"Retrieved meal plan: {plan_id}")
            else:
                logger.warning(f"Meal plan not found: {plan_id}")

            return result

        except Exception as e:
            logger.error(f"Failed to get meal plan {plan_id}: {e}")
            raise DatabaseError(f"Failed to retrieve meal plan: {e}", "GET_FAILED")

    def get_user_plans(
        self,
        user_id: str,
        limit: int = 10,
        status: str = "active"
    ) -> List[Dict[str, Any]]:
        """
        Get all meal plans for a specific user
        """
        try:
            db = self._require_db()

            def _query_operation():
                result = (db.table(settings.GENERATED_PLANS_TABLE)
                          .select("*")
                          .eq("user_id", str(user_id))
                          .eq("status", status)
                          .order("created_at", desc=True)
                          .limit(limit)
                          .execute())
                return result.data or []

            plans = self._retry_operation(_query_operation)
            logger.info(f"Retrieved {len(plans)} plans for user {user_id}")
            return plans

        except Exception as e:
            logger.error(f"Failed to get user plans for {user_id}: {e}")
            raise DatabaseError(f"Failed to retrieve user plans: {e}", "QUERY_FAILED")

    def update_plan_status(self, plan_id: str, status: str, reason: str = "") -> bool:
        """
        Update the status of a meal plan
        """
        try:
            db = self._require_db()

            def _update_operation():
                update_data: Dict[str, Any] = {"status": status}

                if reason:
                    update_data["status_reason"] = reason

                (db.table(settings.GENERATED_PLANS_TABLE)
                 .update(update_data)
                 .eq("id", str(plan_id))
                 .execute())
                return True

            success = self._retry_operation(_update_operation)
            logger.info(f"Updated plan {plan_id} status to {status}")
            return success

        except Exception as e:
            logger.error(f"Failed to update plan status {plan_id}: {e}")
            raise DatabaseError(f"Failed to update plan status: {e}", "UPDATE_FAILED")

    def save_doctor_edit(
        self,
        plan_id: str,
        doctor_id: str,
        edited_plan: Dict[str, Any],
        reason: str = "",
        edit_type: str = "modification"
    ) -> str:
        """
        Save doctor edits with enhanced tracking
        """
        try:
            db = self._require_db()

            def _save_edit_operation():
                row = {
                    "plan_id": str(plan_id),
                    "doctor_id": str(doctor_id),
                    "edited_plan": edited_plan,
                    "reason": reason,
                    "edit_type": edit_type,
                    "status": "active",
                    "version": settings.MODEL_VERSION,
                }

                if edited_plan:
                    row["edit_statistics"] = self._calculate_edit_statistics(edited_plan)

                result = db.table(settings.DOCTOR_EDITS_TABLE).insert(row).execute()
                return result.data[0]["id"]

            edit_id = self._retry_operation(_save_edit_operation)

            # Also update the original plan to reference this edit
            try:
                self._link_edit_to_plan(plan_id, edit_id)
            except Exception as e:
                logger.warning(f"Failed to link edit to plan: {e}")

            logger.success(f"Saved doctor edit with ID: {edit_id}")
            return edit_id

        except Exception as e:
            logger.error(f"Failed to save doctor edit: {e}")
            raise DatabaseError(f"Failed to save doctor edit: {e}", "SAVE_EDIT_FAILED")

    def get_plan_edits(self, plan_id: str) -> List[Dict[str, Any]]:
        """
        Get all edits for a specific plan
        """
        try:
            db = self._require_db()

            def _query_edits():
                result = (db.table(settings.DOCTOR_EDITS_TABLE)
                          .select("*")
                          .eq("plan_id", str(plan_id))
                          .eq("status", "active")
                          .order("created_at", desc=True)
                          .execute())
                return result.data or []

            edits = self._retry_operation(_query_edits)
            logger.info(f"Retrieved {len(edits)} edits for plan {plan_id}")
            return edits

        except Exception as e:
            logger.error(f"Failed to get plan edits for {plan_id}: {e}")
            raise DatabaseError(f"Failed to retrieve plan edits: {e}", "QUERY_EDITS_FAILED")

    def save_user_feedback(
        self,
        plan_id: str,
        user_id: str,
        rating: int,
        feedback: str = "",
        categories: Optional[List[str]] = None
    ) -> str:
        """
        Save user feedback for a meal plan
        """
        try:
            db = self._require_db()

            def _save_feedback():
                row = {
                    "plan_id": str(plan_id),
                    "user_id": str(user_id),
                    "rating": int(rating),
                    "feedback": feedback,
                    "status": "active",
                }

                if categories:
                    row["categories"] = categories

                result = db.table("user_feedback").insert(row).execute()
                return result.data[0]["id"]

            feedback_id = self._retry_operation(_save_feedback)
            logger.success(f"Saved user feedback with ID: {feedback_id}")
            return feedback_id

        except Exception as e:
            logger.error(f"Failed to save user feedback: {e}")
            raise DatabaseError(f"Failed to save user feedback: {e}", "SAVE_FEEDBACK_FAILED")

    def get_analytics_data(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 1000
    ) -> Dict[str, Any]:
        """
        Get analytics data for meal plans
        """
        try:
            db = self._require_db()

            def _get_analytics():
                plans_query = (db.table(settings.GENERATED_PLANS_TABLE)
                               .select("payload")
                               .limit(limit))

                if start_date:
                    plans_query = plans_query.gte("created_at", start_date.isoformat())
                if end_date:
                    plans_query = plans_query.lte("created_at", end_date.isoformat())

                plans_rows = plans_query.execute().data or []

                feedback_rows = (db.table("user_feedback")
                                 .select("rating")
                                 .limit(limit)
                                 .execute().data or [])

                analytics = {
                    "total_plans": len(plans_rows),
                    "total_feedback": len(feedback_rows),
                    "avg_rating": 0.0,
                    "dosha_distribution": {},
                    "user_engagement": {},
                    "generated_at": _now_iso(),
                }

                if feedback_rows:
                    ratings = [row.get("rating") or 0 for row in feedback_rows]
                    analytics["avg_rating"] = sum(ratings) / len(ratings)

                dosha_counts: Dict[str, int] = {}
                for row in plans_rows:
                    payload = row.get("payload") or {}
                    dosha = (payload.get("dosha") or {}).get("dosha", "unknown")
                    dosha_counts[dosha] = dosha_counts.get(dosha, 0) + 1

                analytics["dosha_distribution"] = dosha_counts

                return analytics

            analytics = self._retry_operation(_get_analytics)
            logger.info("Generated analytics data successfully")
            return analytics

        except Exception as e:
            logger.error(f"Failed to get analytics data: {e}")
            raise DatabaseError(f"Failed to retrieve analytics: {e}", "ANALYTICS_FAILED")

    def _calculate_plan_statistics(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate statistics for a meal plan"""
        try:
            stats = {
                "total_days": 0,
                "total_meals": 0,
                "total_items": 0,
                "avg_calories_per_day": 0.0,
                "meal_variety": 0
            }

            if not isinstance(plan, dict):
                return stats

            day_keys = [key for key in plan.keys() if key.startswith('day_')]
            stats["total_days"] = len(day_keys)

            total_calories = 0
            unique_foods = set()
            total_meal_count = 0
            total_item_count = 0

            for day_key in day_keys:
                day_data = plan.get(day_key, {})
                if isinstance(day_data, dict):
                    for meal_type, items in day_data.items():
                        if isinstance(items, list):
                            total_meal_count += 1
                            total_item_count += len(items)

                            for item in items:
                                if isinstance(item, dict):
                                    # Track calories
                                    calories = item.get('calories', 0)
                                    if isinstance(calories, (int, float)):
                                        total_calories += calories

                                    # Track unique foods
                                    food_name = item.get('name', '')
                                    if food_name:
                                        unique_foods.add(food_name.lower())

            stats["total_meals"] = total_meal_count
            stats["total_items"] = total_item_count
            stats["meal_variety"] = len(unique_foods)

            if stats["total_days"] > 0:
                stats["avg_calories_per_day"] = round(total_calories / stats["total_days"], 1)

            return stats

        except Exception as e:
            logger.warning(f"Failed to calculate plan statistics: {e}")
            return {"error": str(e)}

    def _calculate_edit_statistics(self, edited_plan: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate statistics for plan edits"""
        try:
            return {
                "edit_timestamp": _now_iso(),
                "edited_sections": list(edited_plan.keys()) if isinstance(edited_plan, dict) else [],
                "total_changes": len(edited_plan) if isinstance(edited_plan, dict) else 0
            }
        except Exception as e:
            logger.warning(f"Failed to calculate edit statistics: {e}")
            return {"error": str(e)}

    def _link_edit_to_plan(self, plan_id: str, edit_id: str) -> None:
        """Link an edit to the original plan"""
        try:
            db = self._require_db()
            (db.table(settings.GENERATED_PLANS_TABLE)
             .update({"latest_edit_id": edit_id, "has_edits": True})
             .eq("id", str(plan_id))
             .execute())

        except Exception as e:
            logger.warning(f"Failed to link edit {edit_id} to plan {plan_id}: {e}")

    def health_check(self) -> Dict[str, Any]:
        """Perform database health check"""
        try:
            db = self._require_db()

            # A cheap round trip that still proves the connection and key work.
            (db.table(settings.GENERATED_PLANS_TABLE)
             .select("id")
             .limit(1)
             .execute())

            return {
                "status": "healthy",
                "message": "Database operations working",
                "timestamp": _now_iso(),
            }

        except APIError as e:
            logger.error(f"Database health check failed: {e}")
            return {"status": "error", "message": f"Health check failed: {e.message}"}
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return {
                "status": "error",
                "message": f"Health check failed: {str(e)}"
            }


# Global database manager instance
db_manager = SupabaseManager()

# Kept so existing imports of the old class name keep working.
FirestoreManager = SupabaseManager


# Backward compatibility functions
def save_generated_plan(user_id: str, payload: Dict[str, Any]) -> str:
    """Backward compatible save function"""
    return db_manager.save_generated_plan(user_id, payload)


def save_doctor_edit(plan_id: str, doctor_id: str, edited_plan: Dict[str, Any], reason: str = "") -> str:
    """Backward compatible edit save function"""
    return db_manager.save_doctor_edit(plan_id, doctor_id, edited_plan, reason)


def get_plan(plan_id: str) -> Optional[Dict[str, Any]]:
    """Get a meal plan by ID"""
    return db_manager.get_generated_plan(plan_id)


def get_user_plans(user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Get all plans for a user"""
    return db_manager.get_user_plans(user_id, limit)
