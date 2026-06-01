# Meridian needs Python 3.11/3.12 and a CUDA GPU at run time. This image is the
# container Vertex AI runs as a custom training job (attach a GPU in the job spec).
# Base on the CUDA-enabled deep-learning image so TF/JAX find the GPU.
FROM nvidia/cuda:12.3.2-cudnn9-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3.11 python3.11-venv python3-pip git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN python3.11 -m pip install --upgrade pip \
    && python3.11 -m pip install -r requirements.txt

COPY meridian_runner ./meridian_runner
COPY data ./data

# Vertex passes args after the image; default to the full run.
ENTRYPOINT ["python3.11", "-m", "meridian_runner.run"]
