from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from app.api.routes import router
from app.config import CORS_ORIGINS

app = FastAPI(
    title="Macro Atlas API",
    version="0.1.0",
    description="Observed macroeconomic state, historical percentiles, regimes and divergence. No forecasting.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(router)
