"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { label: string; value: number };

const AXIS = { fontSize: 11, fill: "#697386" };

function fmt(v: number, kind: "number" | "currency", currency: string) {
  return kind === "currency"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(v)
    : new Intl.NumberFormat("en-US").format(v);
}

function ChartTooltip({ active, payload, label, kind, currency }: { active?: boolean; payload?: { value: number }[]; label?: string; kind: "number" | "currency"; currency: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-pop">
      <p className="text-muted">{label}</p>
      <p className="font-semibold tabular-nums text-foreground">{fmt(payload[0]!.value, kind, currency)}</p>
    </div>
  );
}

/**
 * Single-series bar chart: one hue, thin bars with rounded data-ends, recessive grid,
 * hover tooltip, and a visually hidden table so the data is not conveyed by graphics alone.
 */
export function BarSeriesChart({
  data,
  title,
  kind = "number",
  currency = "USD",
  layout = "vertical",
  height = 220,
}: {
  data: Point[];
  title: string;
  kind?: "number" | "currency";
  currency?: string;
  layout?: "vertical" | "horizontal";
  height?: number;
}) {
  const horizontal = layout === "horizontal";
  return (
    <figure>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 8, bottom: 0, left: horizontal ? 8 : -12 }} barCategoryGap={horizontal ? 6 : "28%"}>
            <CartesianGrid stroke="#EEF0F4" vertical={horizontal} horizontal={!horizontal} />
            {horizontal ? (
              <>
                <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={AXIS} axisLine={false} tickLine={false} width={92} />
              </>
            ) : (
              <>
                <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={(v: number) => (kind === "currency" ? fmt(v, kind, currency) : String(v))} width={kind === "currency" ? 72 : 40} />
              </>
            )}
            <Tooltip cursor={{ fill: "#F1F4F8" }} content={<ChartTooltip kind={kind} currency={currency} />} />
            <Bar dataKey="value" fill="#536DFE" radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={horizontal ? 18 : 28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{fmt(d.value, kind, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
