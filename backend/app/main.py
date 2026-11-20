from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.database import engine, Base
from app.api.routes_health import router as health_router
from app.api.routes_devices import router as devices_router
from app.api.routes_traffic import router as traffic_router

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="LANscape API",
    version="0.1.0",
    description="Local area network monitoring, device discovery, and floor-plan telemetry platform."
)

# CORS middleware for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(health_router, prefix="/api")
app.include_router(devices_router, prefix="/api")
app.include_router(traffic_router, prefix="/api")


@app.get("/")
def root():
    return {
        "message": "Welcome to LANscape API",
        "docs_url": "/docs",
        "health_url": "/api/health"
    }

