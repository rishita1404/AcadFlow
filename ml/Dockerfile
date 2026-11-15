# ── Stage 1: builder + model training ─────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Also need skl2onnx and scipy for export; add if not in requirements.txt
RUN pip install --no-cache-dir --prefix=/install \
    -r requirements.txt \
    skl2onnx scipy joblib

# Copy source for model training at build time
COPY src/ src/
COPY onnx/ onnx/
# Copy pre-trained artifacts if they exist (avoids long build in CI)
COPY models/ models/

# If model artifacts are absent, train + export now
RUN if [ ! -f models/best_model.joblib ]; then \
      python src/simulate.py && \
      python src/train.py && \
      python onnx/export.py && \
      python onnx/quantize.py; \
    fi

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

RUN useradd --no-create-home --shell /sbin/nologin appuser

WORKDIR /app

COPY --from=builder /install /usr/local
COPY --from=builder /app/models /app/models
COPY --chown=appuser:appuser serve/ serve/
COPY --chown=appuser:appuser src/ src/

USER appuser

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["uvicorn", "serve.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
