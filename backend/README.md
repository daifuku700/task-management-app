# Backend

FastAPI backend managed with `uv`.

## Requirements

- Python 3.11 or later
- `uv`

## Run Locally

Install dependencies:

```bash
uv sync
```

Start the development server:

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API is available at `http://localhost:8000`.

## Current Endpoints

- `GET /tasks`
- `POST /tasks`
- `PUT /tasks/{task_id}`
- `DELETE /tasks/{task_id}`

## CORS

The backend reads allowed frontend origins from `FRONTEND_ORIGINS`.

Example for local development:

```bash
FRONTEND_ORIGINS=http://localhost:5173
```

Example for EC2:

```bash
FRONTEND_ORIGINS=http://<EC2_PUBLIC_IP>:5173
```

Multiple origins can be passed as a comma-separated list:

```bash
FRONTEND_ORIGINS=http://localhost:5173,http://<EC2_PUBLIC_IP>:5173
```

## Docker

There are two useful Docker directions:

1. Development-oriented container
2. Deployment-oriented container

The current Compose-based setup is aimed at development. It prioritizes quick local iteration and can use bind mounts.

For deployment, prefer a Dockerfile with these characteristics:

- use a stable Python base image such as `python:3.11-slim`
- copy `uv` into the image
- install dependencies at build time with `uv sync --frozen --no-cache`
- avoid bind mounts and runtime `uv sync`
- run `uvicorn` from the built virtual environment

Example deployment-oriented Dockerfile:

```dockerfile
FROM python:3.11-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

ENV UV_LINK_MODE=copy
ENV UV_PYTHON_DOWNLOADS=0
ENV PATH="/app/.venv/bin:$PATH"

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-cache --no-install-project

COPY . .
RUN uv sync --frozen --no-cache

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Why This Is Closer to Deployment Best Practice

- dependencies are resolved from `uv.lock`
- the image contains the built environment
- runtime does not mutate the container state
- the container does not depend on mounted host files

This is easier to move to EC2, ECS, or another container platform later.

## Notes

- The current in-memory task store is not persistent.
- Restarting the process removes all tasks.
