FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=65532:65532 doc_verify ./doc_verify
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
USER 65532:65532
HEALTHCHECK --interval=30s --timeout=5s CMD ["python", "-m", "doc_verify.worker", "--readiness"]
CMD ["python", "-m", "doc_verify.worker"]
