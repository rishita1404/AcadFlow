.PHONY: help up down dev seed test lint migrate build clean

help:
	@echo "AcadFlow Makefile Commands:"
	@echo "  make up       - Start docker compose stack"
	@echo "  make down     - Stop docker compose stack"
	@echo "  make dev      - Start stack in development mode"
	@echo "  make seed     - Seed initial data (500 students, 6 accounts)"
	@echo "  make test     - Run backend and ML tests"
	@echo "  make lint     - Run ruff, eslint, and code formatting"
	@echo "  make migrate  - Run alembic database migrations"
	@echo "  make clean    - Remove cached files and containers"

up:
	docker compose -f deploy/docker-compose.yml up -d

down:
	docker compose -f deploy/docker-compose.yml down

dev:
	docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.dev.yml up

seed:
	python scripts/seed_data.py

test:
	pytest backend/tests ml/tests

lint:
	ruff check backend/ ml/
	cd frontend && npm run lint

migrate:
	cd backend && alembic upgrade head

build:
	docker compose -f deploy/docker-compose.yml build

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	rm -rf .pytest_cache .ruff_cache
