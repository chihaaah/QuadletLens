type IconName =
  | "sun"
  | "moon"
  | "open"
  | "copy"
  | "download"
  | "external"
  | "info"
  | "warning"
  | "error";

/** Local 24-unit SVGs share stroke weight and shape; no remote icon font. */
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === "sun" && (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
        </>
      )}
      {name === "moon" && (
        <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" />
      )}
      {name === "open" && (
        <>
          <path d="M3 8V5h6l2 3h10v3M3 8h8M3 11h18l-3 9H3Z" />
        </>
      )}
      {name === "copy" && (
        <>
          <rect x="8" y="8" width="12" height="13" rx="2" />
          <path d="M15 8V3H3v13h5" />
        </>
      )}
      {name === "download" && (
        <>
          <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
        </>
      )}
      {name === "external" && (
        <>
          <path d="M14 3h7v7M21 3l-10 10M10 3H3v18h18v-7" />
        </>
      )}
      {name === "info" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6m0-10v.1" />
        </>
      )}
      {name === "warning" && (
        <>
          <path d="m12 3 10 18H2Z" />
          <path d="M12 9v5m0 3v.1" />
        </>
      )}
      {name === "error" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6m0 4v.1" />
        </>
      )}
    </svg>
  );
}
