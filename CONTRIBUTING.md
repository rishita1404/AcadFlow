# Contributing to AcadFlow

Thank you for your interest in contributing to AcadFlow!

## Branching Strategy
- `main`: Production-ready releases.
- `develop`: Integration branch for tested features.
- `feature/<feature-name>`: New feature implementations.
- `fix/<bug-name>`: Bug fixes and patches.

## Commit Message Conventions
Follow Conventional Commits:
- `feat: add student attendance buffer calculation service`
- `fix: resolve JWT expiration handling in deps.py`
- `docs: update API role-permission matrix`
- `test: add unit tests for risk score calculation`
- `chore: update dependencies in pyproject.toml`

## Pull Request Guidelines
1. Ensure all CI checks (linting, tests, build) pass.
2. Link related issues in the PR description.
3. Update relevant documentation in `docs/` if adding or altering endpoints or architectures.
