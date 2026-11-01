# Contributing to CryptLink

Thank you for your interest in contributing to **CryptLink**. As a mission-critical, high-assurance cryptographic communications platform, all code contributions are held to rigorous engineering, testing, and security standards.

---

## Development Standards

### 1. Code Quality & Formatting
All contributions must pass automated linting and formatting without warnings:
- **Frontend:** Formatted with Prettier (`npm --prefix frontend run format:prettier`) and validated with strict TypeScript (`npm --prefix frontend run typecheck`).
- **Backend:** Formatted and linted with Ruff (`docker exec chat-backend-dev ruff format app/ tests/` and `docker exec chat-backend-dev ruff check app/ tests/`).

### 2. Testing Policy
- **Zero Regression:** Every new feature, cipher modification, or WebSocket frame type must include automated test coverage.
- **Frontend Suites:** Located in `frontend/src/crypto/*.test.ts`. Verified with `npm test -- --run`.
- **Backend Suites:** Located in `backend/tests/`. Verified with `pytest -v`.

---

## Pull Request Guidelines

1. **Create a Feature Branch:** Branch from `master` with descriptive prefixes:
   - `sec/` for security patches and cryptographic enhancements.
   - `feat/` for new tactical capabilities or protocol features.
   - `fix/` for bug fixes and protocol interop issues.
   - `perf/` for low-level latency optimizations.
2. **Atomic Commits:** Follow conventional commits (`feat(crypto): ...`, `fix(websocket): ...`).
3. **Verify Locally:** Ensure all 30 automated unit and end-to-end attack simulation tests pass before pushing.
4. **Documentation:** Update the `README.md` and inline docstrings for any modified APIs or data contracts.
