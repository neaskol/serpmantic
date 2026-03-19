from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pipeline import analyze_corpus
import json
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def log_structured(level: str, message: str, **kwargs):
    """Structured JSON logging"""
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "level": level,
        "message": message,
        **kwargs
    }
    logger.info(json.dumps(log_entry))

app = FastAPI(title="SERPmantics NLP Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    texts: list[str]
    language: str = "fr"


class HealthResponse(BaseModel):
    status: str


@app.get("/health", response_model=HealthResponse)
def health():
    return {"status": "ok"}


@app.get("/health/ready")
def health_ready():
    """Readiness check - verify models are loaded"""
    from pipeline import _models
    return {
        "status": "ready",
        "models_loaded": list(_models.keys()),
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    try:
        log_structured("info", "Analysis started",
                      language=req.language,
                      num_texts=len(req.texts))

        result = analyze_corpus(req.texts, req.language)

        log_structured("info", "Analysis completed",
                      language=req.language,
                      num_terms=len(result["terms"]))

        return result
    except Exception as e:
        log_structured("error", "Analysis failed",
                      language=req.language,
                      error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
