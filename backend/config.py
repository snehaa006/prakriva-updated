"""
Configuration management for the Ayurvedic Meal Planner API
"""
import os
from typing import Optional
from dotenv import load_dotenv
from loguru import logger

# Load environment variables from .env file
load_dotenv()

# Default data/model paths are resolved relative to this file, not the
# process's cwd - Vercel's Python function may run with a different working
# directory than the one this module lives in.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Settings:
    """Application settings with validation"""

    def __init__(self):
        # Flask settings
        self.FLASK_ENV = os.getenv("FLASK_ENV", "development")
        self.DEBUG = os.getenv("DEBUG", "True").lower() == "true"
        self.HOST = os.getenv("HOST", "0.0.0.0")
        self.PORT = int(os.getenv("PORT", 5001))

        # CORS. Comma-separated list of exact origins the frontend is served
        # from (scheme + host, no trailing slash), e.g.
        # "https://prakriva.vercel.app,http://localhost:5173". Vite's dev
        # server defaults are included so local development keeps working
        # without extra setup.
        self.ALLOWED_ORIGINS = [
            origin.strip()
            for origin in os.getenv(
                "ALLOWED_ORIGINS",
                "http://localhost:5173,http://localhost:3000,https://prakriva.vercel.app",
            ).split(",")
            if origin.strip()
        ]

        # API Keys
        self.OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

        # Gemini — narrative analysis of screening results and the patient
        # assistant. Server-side only: a VITE_-prefixed key would be readable in
        # the browser bundle. Absent key disables those features rather than
        # breaking the API.
        #
        # Up to three keys are supported so the chatbot (now used far more than
        # the occasional screening write-up) can roll over to the next key
        # instead of hard-failing when one hits its rate limit or quota.
        # GEMINI_API_KEY stays the primary/first key for backward compatibility.
        self.GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
        self.GEMINI_API_KEYS = [
            key
            for key in (
                self.GEMINI_API_KEY,
                os.getenv("GEMINI_API_KEY2", ""),
                os.getenv("GEMINI_API_KEY3", ""),
            )
            if key
        ]
        self.GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        self.GEMINI_TEMPERATURE = float(os.getenv("GEMINI_TEMPERATURE", 0.3))
        self.GEMINI_MAX_TOKENS = int(os.getenv("GEMINI_MAX_TOKENS", 900))
        self.GEMINI_TIMEOUT_SECONDS = int(os.getenv("GEMINI_TIMEOUT_SECONDS", 30))

        # Supabase. The service-role key bypasses RLS, so it must never be
        # exposed to the browser — server-side only.
        # Falls back to the VITE_-prefixed frontend vars when the
        # backend-only ones aren't set. Note this means Supabase calls run
        # as the anon role (subject to RLS) rather than the privileged
        # service role, since VITE_SUPABASE_ANON_KEY is the only one safe
        # to expose to the browser in the first place.
        self.SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL", "")
        self.SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY", "")

        # Database settings
        self.GENERATED_PLANS_TABLE = os.getenv("GENERATED_PLANS_TABLE", "generated_plans")
        self.DOCTOR_EDITS_TABLE = os.getenv("DOCTOR_EDITS_TABLE", "doctor_edits")

        # ML Model settings
        # The pickle lives next to this module, not in a models/ subdirectory.
        self.MODEL_PATH = os.getenv("MODEL_PATH", os.path.join(BASE_DIR, "dosha_model.pkl"))
        self.MODEL_VERSION = os.getenv("MODEL_VERSION", "1.0.0")

        # Dataset paths
        self.FOOD_DATASET_PATH = os.getenv("FOOD_DATASET_PATH", os.path.join(BASE_DIR, "data/food_dataset.csv"))
        self.DOSHA_DATASET_PATH = os.getenv("DOSHA_DATASET_PATH", os.path.join(BASE_DIR, "data/dosha_dataset.csv"))
        self.PATIENT_DATASET_PATH = os.getenv("PATIENT_DATASET_PATH", os.path.join(BASE_DIR, "data/patient_dataset.csv"))
        self.LIFESTYLE_DATASET_PATH = os.getenv("LIFESTYLE_DATASET_PATH", os.path.join(BASE_DIR, "data/lifestyle_dataset.csv"))
        
        # LLM settings
        self.DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "gpt-4")
        self.MAX_TOKENS = int(os.getenv("MAX_TOKENS", 2000))
        self.TEMPERATURE = float(os.getenv("TEMPERATURE", 0.7))
        self.FOOD_SNIPPET_ROWS = int(os.getenv("FOOD_SNIPPET_ROWS", 60))
        
        # Rate limiting
        self.RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", 30))
        self.RATE_LIMIT_PER_HOUR = int(os.getenv("RATE_LIMIT_PER_HOUR", 500))
        
        # Caching
        self.CACHE_TYPE = os.getenv("CACHE_TYPE", "SimpleCache")
        self.CACHE_DEFAULT_TIMEOUT = int(os.getenv("CACHE_DEFAULT_TIMEOUT", 3600))
        
        # Logging
        self.LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
        self.LOG_FORMAT = os.getenv("LOG_FORMAT", "{time} | {level} | {message}")
    
    def validate_openai_key(self):
        """Validate OpenAI API key"""
        if not self.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        if not self.OPENAI_API_KEY.startswith("sk-"):
            raise ValueError("Invalid OpenAI API key format")
    
    def validate_supabase(self):
        """Validate Supabase connection settings"""
        if not self.SUPABASE_URL:
            raise ValueError("SUPABASE_URL environment variable is required")
        if not self.SUPABASE_URL.startswith("https://"):
            raise ValueError("SUPABASE_URL must be an https:// URL")
        if not self.SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY environment variable is required")

    def validate_all(self):
        """Validate all critical settings"""
        self.validate_openai_key()
        self.validate_supabase()


# Global settings instance
settings = Settings()

# Configure logging.
# Vercel's deployment filesystem is read-only outside of /tmp, so file
# logging would crash the function at import time — skip it there and rely
# on stdout, which Vercel captures as runtime logs.
logger.remove()
if not os.getenv("VERCEL"):
    logger.add(
        "logs/app.log",
        level=settings.LOG_LEVEL,
        format=settings.LOG_FORMAT,
        rotation="1 day",
        retention="30 days",
        compression="zip"
    )
logger.add(
    lambda msg: print(msg, end=""),
    level=settings.LOG_LEVEL,
    format=settings.LOG_FORMAT
)