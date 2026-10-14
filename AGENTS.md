# Project rules

- Keep `packages/core` independent of React, DOM APIs, and browser UI.
- Never silently discard unsupported Compose settings. Emit path-specific diagnostics; errors must prevent incomplete exports.
- All conversion, file reading, and ZIP creation must stay in the browser. No backend, uploads, analytics, telemetry, or remote processing.
- Add meaningful converter tests for every mapping or validation change; run `npm test` and `npm run build` before committing.
- Use strict TypeScript; avoid `any` and unchecked type assertions at input boundaries.
- Keep dependencies minimal. Prefer small browser-compatible libraries and platform APIs.
- Keep output deterministic and document semantic differences from Compose.
- Work on feature branches; never push directly to main.
