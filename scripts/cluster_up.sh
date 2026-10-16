#!/usr/bin/env bash
set -e
echo "Bringing up kind Kubernetes cluster for AcadFlow..."
kind create cluster --config deploy/k8s/kind-config.yaml --name acadflow-cluster
kubectl apply -k deploy/k8s/overlays/kind
echo "AcadFlow cluster is up."
