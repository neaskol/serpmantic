FROM python:3.11-slim as base

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy models (cached layer)
RUN python -m spacy download fr_core_news_sm && \
    python -m spacy download en_core_web_sm && \
    python -m spacy download it_core_news_sm && \
    python -m spacy download de_core_news_sm && \
    python -m spacy download es_core_news_sm

# Copy application code
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Non-root user for security
RUN useradd -m -u 1000 nlp && chown -R nlp:nlp /app
USER nlp

# Expose port
EXPOSE 8001

# Run with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
