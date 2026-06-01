# Small CPU-only container for Cloud Run. No GPU, no TensorFlow — the server
# reads the posterior bundle (results.json) from GCS and serves the MCP tools.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY mcp_server ./mcp_server

# Cloud Run sets $PORT (default 8080). Streamable HTTP is mounted at /mcp.
ENV HOST=0.0.0.0
CMD ["python", "-m", "mcp_server.server"]
