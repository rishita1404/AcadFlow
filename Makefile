.PHONY: help up down dev seed seed-large test test-all lint migrate build clean \
	ml-train ml-export ml-quantize ml-benchmark ml-test \
	k8s-up k8s-down k8s-load-test

PYTHON := python3
VENDOR_PATH := ml/vendor_packages

help:
	@echo "AcadFlow Makefile Commands:"
	@echo "  make up             - Start docker compose stack (core profile)"
	@echo "  make down           - Stop docker compose stack"
	@echo "  make dev            - Start stack in development mode"
	@echo "  make seed           - Seed initial data (500 students, 6 accounts)"
	@echo "  make seed-large     - Seed large dataset (~3,000 students for virtualization tests)"
	@echo "  make test           - Run backend and ML tests"
	@echo "  make test-all       - Run full test suite: backend, ML, and frontend Vitest"
	@echo "  make lint           - Run ruff on Python and ESLint on frontend"
	@echo "  make migrate        - Run alembic database migrations"
	@echo "  make build          - Build production docker images"
	@echo "  make clean          - Remove cached files and containers"
	@echo "  make ml-train       - Train simulated risk model with reproducibility seed"
	@echo "  make ml-export      - Export scikit-learn model to ONNX format"
	@echo "  make ml-quantize    - Dynamically quantize ONNX model to INT8"
	@echo "  make ml-benchmark   - Run latency and throughput benchmark across batch sizes"
	@echo "  make ml-test        - Run ML unit and API integration tests"
	@echo "  make k8s-up         - Create kind cluster, build and load images, apply base K8s"
	@echo "  make k8s-down       - Tear down local kind cluster"
	@echo "  make k8s-load-test  - Run Locust load test to trigger Kubernetes HPA scaling"

up:
	docker compose --profile core up -d

down:
	docker compose --profile core --profile ml --profile mlflow --profile monitoring down

dev:
	docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.dev.yml up

seed:
	$(PYTHON) scripts/seed_data.py

seed-large:
	$(PYTHON) scripts/seed_large_dataset.py

test:
	$(PYTHON) -m pytest backend/tests/
	PYTHONPATH=$(VENDOR_PATH):$$PYTHONPATH $(PYTHON) -m pytest ml/tests/

test-all:
	$(PYTHON) -m pytest backend/tests/
	PYTHONPATH=$(VENDOR_PATH):$$PYTHONPATH $(PYTHON) -m pytest ml/tests/
	cd frontend && npx vitest run

lint:
	ruff check backend/ ml/
	cd frontend && npm run lint

migrate:
	cd backend && alembic upgrade head

build:
	docker compose build

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	rm -rf .pytest_cache .ruff_cache frontend/dist

ml-train:
	PYTHONPATH=$(VENDOR_PATH):$$PYTHONPATH $(PYTHON) ml/src/train.py

ml-export:
	PYTHONPATH=$(VENDOR_PATH):$$PYTHONPATH $(PYTHON) ml/onnx/export.py

ml-quantize:
	PYTHONPATH=$(VENDOR_PATH):$$PYTHONPATH $(PYTHON) ml/onnx/quantize.py

ml-benchmark:
	PYTHONPATH=$(VENDOR_PATH):$$PYTHONPATH $(PYTHON) ml/onnx/benchmark.py

ml-test:
	PYTHONPATH=$(VENDOR_PATH):$$PYTHONPATH $(PYTHON) -m pytest ml/tests/ -v

k8s-up:
	@echo "Checking or creating kind cluster..."
	kind create cluster --name acadflow-cluster --config deploy/k8s/kind-config.yaml || true
	@echo "Building application images..."
	docker build -t acadflow-backend:latest backend/
	docker build -t acadflow-ml-serve:latest ml/
	docker build -t acadflow-frontend:latest frontend/
	@echo "Loading images into kind cluster..."
	kind load docker-image acadflow-backend:latest --name acadflow-cluster
	kind load docker-image acadflow-ml-serve:latest --name acadflow-cluster
	kind load docker-image acadflow-frontend:latest --name acadflow-cluster
	@echo "Applying Kubernetes manifests via Kustomize..."
	kubectl apply -f deploy/k8s/base/namespace.yaml
	kubectl apply -f deploy/k8s/base/secret.example.yaml
	kubectl apply -k deploy/k8s/base/

k8s-down:
	kind delete cluster --name acadflow-cluster

k8s-load-test:
	locust -f load-tests/locustfile.py --headless -u 80 -r 10 --run-time 2m --host http://localhost:8000
