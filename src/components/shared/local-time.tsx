"use client";

/** Renders a timestamp in the viewer's locale/time zone. Server and browser may differ, which is expected. */
export function LocalTime({ value, dateOnly = false }: { value: Date | string; dateOnly?: boolean }) {
  const d = new Date(value);
  return (
    <time dateTime={d.toISOString()} suppressHydrationWarning>
      {dateOnly ? d.toLocaleDateString() : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
    </time>
  );
}
