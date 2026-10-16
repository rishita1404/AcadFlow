#!/usr/bin/env bash
set -e
echo "Bootstrapping AcadFlow development environment..."
python3 --version
docker --version
docker compose version
echo "Environment check passed."
