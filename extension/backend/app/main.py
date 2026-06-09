import os
import sys

# Resolve paths dynamically to prevent ModuleNotFoundError when launching backend
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import analyze, health

# Initialize the FastAPI application
app = FastAPI(
    title="DeceptiScan Review Intelligence API",
    description="FastAPI service serving the DeBERTa-v3 sequence classification model for review authenticity analysis.",
    version="1.0.0"
)

# Set up CORS middleware to allow the Chrome/browser extension context to call it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register endpoints
app.include_router(analyze.router, prefix="/api", tags=["Analysis"])
app.include_router(health.router, prefix="/api", tags=["Diagnostics"])

if __name__ == "__main__":
    import uvicorn
    # Start the server locally on localhost:8000
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True, app_dir=current_dir)
