FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY doc_verify ./doc_verify
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
USER 65532:65532
HEALTHCHECK --interval=30s --timeout=5s CMD ["python", "-m", "doc_verify.worker", "--readiness"]
CMD ["python", "-m", "doc_verify.worker"]
