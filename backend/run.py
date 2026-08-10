#!/usr/bin/env python3
"""
Production runner for Ayurvedic Meal Planner API
Includes health checks, graceful shutdown, and monitoring
"""
import os
import sys
import signal
import threading
import time
from contextlib import contextmanager
from loguru import logger

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, create_app
from config import settings
from db import db_manager
from dataset_loader import dataset_loader


class ProductionRunner:
    """Production-ready application runner"""
    
    def __init__(self):
        self.app = None
        self.shutdown_event = threading.Event()
        self.health_check_thread = None
        self.setup_signal_handlers()
    
    def setup_signal_handlers(self):
        """Setup graceful shutdown signal handlers"""
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)
        
        if hasattr(signal, 'SIGHUP'):
            signal.signal(signal.SIGHUP, self._reload_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}, initiating graceful shutdown...")
        self.shutdown_event.set()
    
    def _reload_handler(self, signum, frame):
        """Handle reload signals (SIGHUP)"""
        logger.info("Received SIGHUP, reloading configuration...")
        # Implement configuration reload logic here
    
    def validate_environment(self):
        """Validate environment setup"""
        logger.info("Validating environment configuration...")
        
        required_env_vars = [
            'SUPABASE_URL',
            'SUPABASE_SERVICE_ROLE_KEY'
        ]

        missing_vars = []
        for var in required_env_vars:
            if not os.getenv(var):
                missing_vars.append(var)

        if missing_vars:
            raise EnvironmentError(f"Missing required environment variables: {missing_vars}")

        # OpenAI is optional — only the LLM meal-planning / dosha-refinement
        # features need it. The disease-detection models and the rest of the API
        # boot without it, so the backend can be deployed for free with no key.
        if not os.getenv('OPENAI_API_KEY'):
            logger.warning(
                "OPENAI_API_KEY not set — LLM meal planning and dosha refinement "
                "are disabled; disease detection and the ML dosha model still work."
            )

        settings.validate_supabase()

        logger.success("Environment validation passed")
    
    def validate_datasets(self):
        """Validate required datasets"""
        logger.info("Validating datasets...")
        
        required_datasets = [
            settings.FOOD_DATASET_PATH,
        ]
        
        missing_files = []
        for dataset_path in required_datasets:
            if not os.path.exists(dataset_path):
                missing_files.append(dataset_path)
        
        if missing_files:
            logger.warning(f"Missing dataset files: {missing_files}")
            logger.warning("API will run with limited functionality")
        else:
            logger.success("Dataset validation passed")
    
    def initialize_services(self):
        """Initialize all required services"""
        logger.info("Initializing services...")
        
        # Test database connection
        try:
            db_health = db_manager.health_check()
            if db_health.get('status') != 'healthy':
                logger.warning(f"Database health check warning: {db_health}")
            else:
                logger.success("Database connection established")
        except Exception as e:
            logger.error(f"Database initialization failed: {e}")
            raise
        
        # Load datasets
        try:
            datasets = dataset_loader.load_all_datasets()
            logger.success(f"Loaded {len(datasets)} datasets")
            
            # Log dataset info
            for name, df in datasets.items():
                if df is not None:
                    logger.info(f"{name} dataset: {len(df)} records")
        except Exception as e:
            logger.warning(f"Dataset loading failed: {e}")
            logger.warning("Continuing with limited functionality")
        
        logger.success("Service initialization completed")
    
    def start_health_monitor(self):
        """Start background health monitoring"""
        def health_monitor():
            while not self.shutdown_event.is_set():
                try:
                    # Periodic health checks
                    db_health = db_manager.health_check()
                    
                    if db_health.get('status') != 'healthy':
                        logger.warning(f"Health check warning: {db_health}")
                    
                    # Sleep for 5 minutes between checks
                    self.shutdown_event.wait(300)
                    
                except Exception as e:
                    logger.error(f"Health monitor error: {e}")
                    self.shutdown_event.wait(60)  # Wait 1 minute on error
        
        if settings.FLASK_ENV == 'production':
            self.health_check_thread = threading.Thread(target=health_monitor, daemon=True)
            self.health_check_thread.start()
            logger.info("Health monitoring started")
    
    def setup_logging(self):
        """Setup production logging"""
        # Replace the handlers config.py installed at import time with the
        # runner's own.
        logger.remove()

        # Console logging always comes first, in every environment. Hosted
        # platforms (Render, Vercel, Docker) capture stdout as *the* log
        # stream — they cannot read logs/app.log, and the container's disk is
        # thrown away on redeploy. Making this development-only meant every
        # production boot, including a crash during startup, was completely
        # silent in the Render dashboard.
        logger.add(
            sys.stdout,
            level=settings.LOG_LEVEL,
            format=settings.LOG_FORMAT,
            colorize=settings.FLASK_ENV == 'development',
        )

        # File logging is a local convenience on top of that. A read-only or
        # full filesystem must not take the process down, so failures here are
        # reported to stdout and otherwise ignored.
        log_file = "logs/app.log"
        try:
            os.makedirs(os.path.dirname(log_file), exist_ok=True)
            logger.add(
                log_file,
                rotation="1 day",
                retention="30 days",
                level=settings.LOG_LEVEL,
                format=settings.LOG_FORMAT,
                compression="zip"
            )
        except OSError as e:
            logger.warning(f"File logging disabled ({log_file}: {e}); logging to stdout only")

        logger.success("Logging configured successfully")
    
    def create_directories(self):
        """Create necessary directories"""
        dirs = ['logs', 'models', 'data']
        for dir_name in dirs:
            os.makedirs(dir_name, exist_ok=True)
        logger.info("Created necessary directories")
    
    @contextmanager
    def application_context(self):
        """Application context manager"""
        try:
            logger.info("Starting Ayurvedic Meal Planner API...")
            yield
        except KeyboardInterrupt:
            logger.info("Received keyboard interrupt")
        except Exception as e:
            logger.error(f"Application error: {e}")
            raise
        finally:
            logger.info("Shutting down gracefully...")
            self.shutdown_event.set()
            
            if self.health_check_thread and self.health_check_thread.is_alive():
                logger.info("Stopping health monitor...")
                self.health_check_thread.join(timeout=5)
            
            logger.success("Shutdown completed")
    
    def run(self):
        """Main application runner"""
        try:
            # Setup
            self.create_directories()
            self.setup_logging()
            self.validate_environment()
            self.validate_datasets()
            self.initialize_services()
            
            # Start monitoring
            self.start_health_monitor()
            
            # Log startup info
            logger.info(f"Environment: {settings.FLASK_ENV}")
            logger.info(f"Debug mode: {settings.DEBUG}")
            logger.info(f"Host: {settings.HOST}")
            logger.info(f"Port: {settings.PORT}")
            logger.info(f"Model version: {settings.MODEL_VERSION}")
            
            with self.application_context():
                # Configure app for production
                if settings.FLASK_ENV == 'production':
                    # Use a production WSGI server
                    try:
                        from waitress import serve
                        logger.info("Starting with Waitress WSGI server...")
                        serve(
                            app,
                            host=settings.HOST,
                            port=settings.PORT,
                            threads=8,
                            connection_limit=1000,
                            cleanup_interval=30,
                            channel_timeout=120
                        )
                    except ImportError:
                        logger.warning("Waitress not installed, falling back to Flask dev server")
                        app.run(
                            host=settings.HOST,
                            port=settings.PORT,
                            debug=False,
                            threaded=True
                        )
                else:
                    # Development server
                    logger.info("Starting Flask development server...")
                    app.run(
                        host=settings.HOST,
                        port=settings.PORT,
                        debug=settings.DEBUG,
                        threaded=True,
                        use_reloader=False  # Disable reloader to avoid issues
                    )
        
        except Exception as e:
            logger.error(f"Failed to start application: {e}")
            sys.exit(1)


def main():
    """Main entry point"""
    runner = ProductionRunner()
    runner.run()


if __name__ == "__main__":
    main()