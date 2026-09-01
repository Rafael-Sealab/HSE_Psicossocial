#! /usr/bin/env bash

set -e

# Railway fornece PORT dinamicamente. Em Docker Compose, usamos 8000.
PORT="${PORT:-8000}"
WEB_CONCURRENCY="${WEB_CONCURRENCY:-2}"

# Aguarda o PostgreSQL, aplica as migrações e garante o usuário inicial.
bash scripts/prestart.sh

exec fastapi run --host 0.0.0.0 --port "${PORT}" --workers "${WEB_CONCURRENCY}"
