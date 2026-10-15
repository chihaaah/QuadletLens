# Compose2Quadlet design

This document is the source of truth for future UI changes. Implement tokens in `apps/web/src/style.css`, interface strings in `i18n.ts`, and diagnostic presentation translations in `diagnostics-i18n.ts`.

## Principles

Compose2Quadlet is a developer tool. Show the conversion workspace immediately, with compact controls, clear headings, subtle separators and little decoration. Use the application name alone as branding. No hero, marketing slogans, gradients, illustrations, remote fonts, decorative cards or shadows.

The [Stitch documentation reference](https://stitch.withgoogle.com/docs/design-md/overview) informs the restrained typography and separators. Do not copy its branding, navigation, layout or assets.

## Selective Material Design 3

Keep the Stitch-inspired layout flat and compact. Apply Material 3 to action hierarchy, segmented controls, local icons, semantic tonal surfaces and interaction states. This is an adaptation for a desktop developer tool, not a full Material/Android component system. Do not add elevated cards, FABs, pill-shaped controls, ripples, large typography, gradients or decorative motion.

- **Hierarchy:** Convert is the only prominent filled action. Open, Copy and Download use neutral outlines; Load sample is a text-style action.
- **Controls:** normal buttons use a 32px minimum height, 7px/12px padding and 8px radius. The EN/JP segmented group is 32px high, with 30px internal segments, a shared outline and an understated selected tone. Selection also uses semibold text and `aria-pressed`.
- **Icon button:** theme is always an icon-only 32px square with an 8px radius. Keep localized accessible labels and a native tooltip describing the next action.
- **States:** local `::before` overlays use current label/icon color at 8% hover, 12% keyboard focus and 16% press. These are project-specific Material-inspired state-layer values. Focus additionally has a visible 2px accent outline; selected tabs have a tonal fill and underline. Disabled controls use 38% opacity, native disabled semantics and no active state layer. Do not move controls on press.
- **Surfaces:** page, editor, header and toolbars use separate neutral tonal roles. Selected segments/tabs use `--selection`. Use 1px separators, not elevation shadows. Keep one workspace boundary rather than cards around every section.
- **Diagnostics/forms:** small tonal severity labels combine text with info/warning/error icons. A restrained 2px leading rule helps distinguish entries. Failed conversion sets the textarea's `aria-invalid` and a subtle error boundary; keyboard focus retains the accent indicator. Errors and stale-export blocking keep their existing behavior.
- **Icons:** authored local SVGs in `Icon.tsx`, using a 24-unit grid, 1.7-unit rounded strokes and 16px normal size (18px theme; 13px metadata/severity). Icons supplement labels and use `aria-hidden`; no icon font, remote resources or component-library dependency.
- **Color:** reserve primary accent for Convert, selected controls, focus and interactive highlights. Code keys use a separate muted neutral token. Severity colors are limited to diagnostics.
- **Motion:** background, border, color and state-layer transitions use `--motion: 150ms`. No decorative motion, springs or layout animation. `prefers-reduced-motion` sets this duration to zero.

References: [Material Web button hierarchy](https://github.com/material-components/material-web/blob/main/docs/components/button.md) and [state-layer guidance](https://github.com/material-components/material-web/blob/main/docs/components/ripple.md). Implement these principles with existing HTML/CSS and local SVGs.

## Layout

- The migration workflow starts with a compact target-version control and readiness strip above the editor. Show service/manual/blocker totals and clearly labelled finding counts, with flat separators and no cards. Native expandable logging, service and category/path details preserve every original diagnostic and keyboard access. Target/source edits mark the analysis stale and disable exports.
- Output is a generated preview. Every blocked file displays a textual PREVIEW ONLY / not-exportable notice and its omitted paths, including a document-level blocker explanation for otherwise unaffected files. Viewing/selecting text remains possible; Copy, Download and ZIP remain disabled for the complete blocked transaction. No success notice may imply a blocked preview is deployable. Unspecified target versions require host verification; provide only unspecified/custom controls, not an arbitrary version list.

- Full-width 56px header: application name, EN / JP, theme toggle, GitHub.
- Main region: max-width 1600px, 28px horizontal inset, 24px top inset.
- Desktop workspace: two equal columns within one thin boundary. A single vertical separator divides input/output.
- Each pane: 44px section heading, 44px toolbar/file tabs, code area, 48px action row.
- Desktop code height: `clamp(320px, 100svh - 420px, 560px)` so the diagnostic summary remains close to the first viewport.
- Compose editor and selected Quadlet output have equal prominence. Output tabs use literal filenames and scroll horizontally within their own area.
- Diagnostics sit directly below the workspace. Counts remain visible; the list scrolls within a 240px maximum height. Each entry has a textual severity label, a technical path and an explanation. Never hide errors.
- Repeated logging errors may share a compact native details/summary row showing total errors and affected services. Expansion preserves every original path/message; grouping never changes core diagnostics, counts or export eligibility. Localize both EN/JP summaries and keep keyboard disclosure/focus accessible. Do not use large cards.
- Footer: one privacy note, plus a concise live status. No promotional or repeated explanatory copy.

## Typography

Use system UI fonts: `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`. Use `ui-monospace`, `SFMono-Regular`, `Consolas`, `Liberation Mono`, `monospace` for editors, file tabs and diagnostic paths. No font/CDN requests.

- App name: 16px, weight 600 (14px on small screens).
- Section headings: 13px, weight 600.
- Buttons/body diagnostics: 12px. Metadata/footer: 11px. Severity labels: 10px.
- Code: 13px, line-height 1.75. Keep whitespace; allow horizontal scrolling inside code areas.
- Avoid all-caps prose and large headings. Technical identifiers remain unchanged in either language.

## Theme tokens

All components use semantic CSS variables; theme overrides only change token values. Dark is charcoal rather than pure black; light uses warm off-white surfaces rather than stark white.

| Token                        | Light                 | Dark                  | Use                        |
| ---------------------------- | --------------------- | --------------------- | -------------------------- |
| `--page`                     | `#f5f5f2`             | `#202328`             | Page background            |
| `--surface`                  | `#fafaf8`             | `#25292f`             | Controls/headings          |
| `--toolbar`                  | `#eeefec`             | `#2b3037`             | Toolbars and pane headings |
| `--editor`                   | `#fdfdfa`             | `#22262b`             | Code surfaces              |
| `--text`                     | `#272c33`             | `#e1e4e8`             | Primary text               |
| `--muted`                    | `#626973`             | `#a5adb7`             | Supporting text            |
| `--border`                   | `#d4d8d3`             | `#424950`             | Separators                 |
| `--accent`                   | `#315da8`             | `#abc7f7`             | Convert/focus/selected tab |
| `--on-accent`                | `#ffffff`             | `#1c304d`             | Primary button text        |
| `--selection`                | `#e8edf5`             | `#303c50`             | Selected tab               |
| `--warning` / `--warning-bg` | `#775211` / `#f3ecd9` | `#e2bf7c` / `#393326` | Review labels/stale output |
| `--error` / `--error-bg`     | `#a13236` / `#f7e8e7` | `#f1a3a6` / `#402d32` | Error labels               |
| `--info` / `--info-bg`       | `#3a5f7c` / `#e8eef2` | `#b0cce0` / `#2c3842` | Info labels                |
| `--code-section`             | `#3d6850`             | `#acd3b8`             | INI sections               |
| `--code-key`                 | `#4a5966`             | `#b8c4cf`             | Neutral INI keys           |

Theme defaults to `prefers-color-scheme` and follows changes until the user makes a manual selection. The toggle persists `light`/`dark` in `compose2quadlet.theme`. Resolve theme before first paint. Blocked/unavailable storage must not break the app; preferences still work for the current session. Never store Compose content.

## Spacing and components

Use 4/8/12/16/20/24/28px spacing. Normal controls have at least 32px height, 7px vertical/12px horizontal padding, a 1px boundary and 8px radius. Keep primary accent fill for Convert. Downloads use neutral buttons; Download all includes a small ZIP label. File tabs retain flat joined edges and the workspace retains one restrained boundary.

The YAML editor is a native textarea. File input is triggered by a semantic button, works by keyboard, and accepts one local `.yml`/`.yaml` file. Drag/drop uses the same loading path. Preserve all existing conversion/export functions and stale-output blocking.

Selected tabs have a background, accent underline and `aria-selected`. Use roving focus: arrows move between tabs, Home/End select first/last. Output and the scrolling diagnostic list are keyboard-focusable. Every interactive control has a visible 2px focus indicator. The theme icon has a localized accessible label. Diagnostic labels convey severity using words as well as color. Keep normal text contrast at least 4.5:1 against its surface. Reserve a stable root scrollbar gutter to avoid content clipping or layout shifts as diagnostics grow.

## Language

EN / JP is always visible. Without a saved preference, Japanese browser locales default to `ja`; other locales default to `en`. Store explicit selections in `compose2quadlet.language`; update the document `lang` attribute. Changing language updates interface text, statuses and known diagnostics immediately, without changing source input, filenames or generated contents.

Use an internal typed dictionary, with no translation service or runtime machine translation. Localize short labels, counts, notices and accessible names. Technical names such as Docker Compose, Podman, Quadlet, `.container`, `.network`, `.volume` and diagnostic paths are not translated. Preserve original YAML parser details and any future unknown diagnostic verbatim rather than dropping information; add dictionary entries when introducing new diagnostics.

Privacy wording appears once: “Files are processed locally in your browser.” / “ファイルはブラウザ内で処理されます。”

## Responsive behavior

At 800px or below, stack input and output; replace the vertical separator with a horizontal one. Use 16px page insets and a 320px code area. At 480px or below, use 12px insets, retain the segmented language group and icon-only theme button, wrap the header/action rows if needed, place the drop hint on its own line, and keep downloads readable. Avoid page-level horizontal scrolling. Long code and filename tabs may scroll within their containers.

## Verification

Before UI changes are complete, inspect light/dark and EN/JP on desktop and at a narrow viewport, exercise keyboard/file/export/error flows, verify preference persistence, and run `npm test` plus `npm run build`. Converter behavior and generated files must remain unchanged by display preferences.
