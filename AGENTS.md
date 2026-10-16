# Project rules

- Keep `packages/core` independent of React, DOM APIs, and browser UI.
- Never silently discard unsupported Compose settings. Emit path-specific diagnostics; errors must prevent incomplete exports.
- All conversion, file reading, and ZIP creation must stay in the browser. No backend, uploads, analytics, telemetry, or remote processing.
- Add meaningful converter tests for every mapping or validation change; run `npm test` and `npm run build` before committing.
- Use strict TypeScript; avoid `any` and unchecked type assertions at input boundaries.
- Keep dependencies minimal. Prefer small browser-compatible libraries and platform APIs.
- Use [DESIGN.md](DESIGN.md) as the source of truth for UI changes. Keep interface translations in the web app; core diagnostics and generated identifiers stay UI-independent.
- Keep output deterministic and document semantic differences from Compose.
- Work on feature branches; never push directly to main.

- Use QuadletLens as the public product name, `https://quadletlens.chiha.dev/` as the production URL, and `https://github.com/chihaaah/QuadletLens` for repository links. Preserve same-origin legacy preference reads; never store Compose input or secrets.
