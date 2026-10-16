# ADR 0001: Record Architecture Decisions

## Context
AcadFlow requires modular separation between core academic transaction services and ML risk inference.

## Decision
We adopt a microservice boundary between the core FastAPI backend and the ML model serving layer, communicating via internal REST with client credentials.

## Status
Accepted
