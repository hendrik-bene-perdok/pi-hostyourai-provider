# Changelog

## 0.1.1 — 2026-10-01

- Harden model-catalog parsing and reject unsafe or unsupported entries.
- Sanitize model labels, deduplicate model IDs, and bound catalog size and model token limits.
- Add a 15-second catalog timeout, abort handling, and redirect rejection.
- Convert EUR catalog prices to approximate USD estimates with a configurable rate.
- Document npm/Git install, update, and remove commands, credential removal, privacy, and cost limitations.
- Add catalog-mapping tests for filtering, sanitization, limit bounds, image flags, and pricing.
