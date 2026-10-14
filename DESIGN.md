# Compose2Quadlet design

This document is the source of truth for future UI changes. Implement tokens in `apps/web/src/style.css`, interface strings in `i18n.ts`, and diagnostic presentation translations in `diagnostics-i18n.ts`.

## Principles

Compose2Quadlet is a developer tool. Show the conversion workspace immediately, with compact controls, clear headings, subtle separators and little decoration. Use the application name alone as branding. No hero, marketing slogans, gradients, illustrations, remote fonts, decorative cards or shadows.

The [Stitch documentation reference](https://stitch.withgoogle.com/docs/design-md/overview) informs the restrained typography and separators. Do not copy its branding, navigation, layout or assets.

## Layout

- Full-width 56px header: application name, EN / JP, theme toggle, GitHub.
- Main region: max-width 1600px, 28px horizontal inset, 24px top inset.
- Desktop workspace: two equal columns within one thin boundary. A single vertical separator divides input/output.
- Each pane: 44px section heading, 44px toolbar/file tabs, code area, 48px action row.
- Desktop code height: `clamp(320px, 100svh - 420px, 560px)` so the diagnostic summary remains close to the first viewport.
- Compose editor and selected Quadlet output have equal prominence. Output tabs use literal filenames and scroll horizontally within their own area.
- Diagnostics sit directly below the workspace. Counts remain visible; the list scrolls within a 240px maximum height. Each entry has a textual severity label, a technical path and an explanation. Never hide errors.
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
| `--editor`                   | `#fdfdfa`             | `#22262b`             | Code surfaces              |
| `--hover`                    | `#eaece8`             | `#32383f`             | Hover feedback             |
| `--text`                     | `#272c33`             | `#e1e4e8`             | Primary text               |
| `--muted`                    | `#626973`             | `#a5adb7`             | Supporting text            |
| `--border`                   | `#d4d8d3`             | `#424950`             | Separators                 |
| `--accent`                   | `#315da8`             | `#abc7f7`             | Convert/focus/selected tab |
| `--accent-hover`             | `#284d8b`             | `#c0d6fb`             | Primary hover              |
| `--on-accent`                | `#ffffff`             | `#1c304d`             | Primary button text        |
| `--selection`                | `#e8edf5`             | `#303c50`             | Selected tab               |
| `--warning` / `--warning-bg` | `#775211` / `#f3ecd9` | `#e2bf7c` / `#393326` | Review labels/stale output |
| `--error` / `--error-bg`     | `#a13236` / `#f7e8e7` | `#f1a3a6` / `#402d32` | Error labels               |
| `--info` / `--info-bg`       | `#3a5f7c` / `#e8eef2` | `#b0cce0` / `#2c3842` | Info labels                |
| `--code-section`             | `#3d6850`             | `#acd3b8`             | INI sections               |
| `--code-key`                 | `#315da8`             | `#abc7f7`             | INI keys                   |

Theme defaults to `prefers-color-scheme` and follows changes until the user makes a manual selection. The toggle persists `light`/`dark` in `compose2quadlet.theme`. Resolve theme before first paint. Blocked/unavailable storage must not break the app; preferences still work for the current session. Never store Compose content.

## Spacing and components

Use 4/8/12/16/20/24/28px spacing. Controls have at least 30px height, 6px vertical/10px horizontal padding, a 1px boundary and 5px radius. Keep primary accent fill for Convert. Downloads use neutral buttons; Download all includes a small ZIP label.

The YAML editor is a native textarea. File input is triggered by a semantic button, works by keyboard, and accepts one local `.yml`/`.yaml` file. Drag/drop uses the same loading path. Preserve all existing conversion/export functions and stale-output blocking.

Selected tabs have a background, accent underline and `aria-selected`. Use roving focus: arrows move between tabs, Home/End select first/last. Output and the scrolling diagnostic list are keyboard-focusable. Every interactive control has a visible 2px focus indicator. The theme icon has a localized accessible label. Diagnostic labels convey severity using words as well as color. Keep normal text contrast at least 4.5:1 against its surface. Reserve a stable root scrollbar gutter to avoid content clipping or layout shifts as diagnostics grow.

## Language

EN / JP is always visible. Without a saved preference, Japanese browser locales default to `ja`; other locales default to `en`. Store explicit selections in `compose2quadlet.language`; update the document `lang` attribute. Changing language updates interface text, statuses and known diagnostics immediately, without changing source input, filenames or generated contents.

Use an internal typed dictionary, with no translation service or runtime machine translation. Localize short labels, counts, notices and accessible names. Technical names such as Docker Compose, Podman, Quadlet, `.container`, `.network`, `.volume` and diagnostic paths are not translated. Preserve original YAML parser details and any future unknown diagnostic verbatim rather than dropping information; add dictionary entries when introducing new diagnostics.

Privacy wording appears once: “Files are processed locally in your browser.” / “ファイルはブラウザ内で処理されます。”

## Responsive behavior

At 800px or below, stack input and output; replace the vertical separator with a horizontal one. Use 16px page insets and a 320px code area. At 480px or below, use 12px insets; hide only the theme's visible text (keep icon/accessible label), wrap the header if needed, place the drop hint on its own line, and keep downloads readable. Avoid page-level horizontal scrolling. Long code and filename tabs may scroll within their containers.

## Verification

Before UI changes are complete, inspect light/dark and EN/JP on desktop and at a narrow viewport, exercise keyboard/file/export/error flows, verify preference persistence, and run `npm test` plus `npm run build`. Converter behavior and generated files must remain unchanged by display preferences.
