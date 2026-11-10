"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { z } from "zod";
import { errorOf, Field, FormGrid, fieldProps, useActionSubmit } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { addDaysISO, todayISO } from "@/lib/dates";
import { calculateInvoiceTotals, formatMoney } from "@/lib/money";
import { invoiceSchema } from "@/lib/validations/entities";
import { createInvoiceAction, updateInvoiceAction } from "@/server/actions/business";

type Values = z.infer<typeof invoiceSchema>;

export function InvoiceForm({
  invoiceId,
  initial,
  clients,
  projects,
  currency,
  defaultTaxRate,
}: {
  invoiceId?: string;
  initial?: Values;
  clients: { id: string; name: string; companyName: string | null }[];
  projects: { id: string; name: string; clientId: string }[];
  currency: string;
  defaultTaxRate: string;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: initial ?? {
      clientId: "",
      projectId: "",
      issueDate: todayISO(),
      dueDate: addDaysISO(14),
      taxRate: Number(defaultTaxRate).toString(),
      notes: "",
      items: [{ description: "", quantity: "1", unitPrice: "" }],
    },
  });
  const items = useFieldArray({ control: form.control, name: "items" });
  const watched = form.watch();
  const clientProjects = projects.filter((p) => p.clientId === watched.clientId);

  // Live preview using the same exact-decimal maths as the server (server recalculates on save).
  const totals = useMemo(() => {
    try {
      return calculateInvoiceTotals(
        watched.items.map((i) => ({ quantity: i.quantity || "0", unitPrice: i.unitPrice || "0" })),
        watched.taxRate || "0",
      );
    } catch {
      return null;
    }
  }, [watched.items, watched.taxRate]);

  const onSubmit = useActionSubmit(
    form,
    (v: Values) => (invoiceId ? updateInvoiceAction({ id: invoiceId, invoice: v }) : createInvoiceAction(v)),
    { success: invoiceId ? "Invoice updated." : "Invoice created as a draft.", redirectTo: (d) => `/app/invoices/${(d as { id: string }).id}` },
  );
  const itemError = (i: number, key: "description" | "quantity" | "unitPrice") => form.formState.errors.items?.[i]?.[key]?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Card>
        <CardContent className="py-5">
          <FormGrid>
            <Field label="Client" htmlFor="clientId" error={errorOf(form, "clientId")} required>
              <Select {...fieldProps(form, "clientId")} onChange={(e) => (form.setValue("clientId", e.target.value, { shouldValidate: true }), form.setValue("projectId", ""))}>
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName ?? c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Project (optional)" htmlFor="projectId" error={errorOf(form, "projectId")}>
              <Select {...fieldProps(form, "projectId")} disabled={!watched.clientId}>
                <option value="">No project</option>
                {clientProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Issue date" htmlFor="issueDate" error={errorOf(form, "issueDate")} required>
              <Input type="date" {...fieldProps(form, "issueDate")} />
            </Field>
            <Field label="Due date" htmlFor="dueDate" error={errorOf(form, "dueDate")} required>
              <Input type="date" {...fieldProps(form, "dueDate")} />
            </Field>
          </FormGrid>
        </CardContent>
      </Card>

      <Card>
        <div className="hidden grid-cols-[1fr_100px_140px_120px_40px] gap-3 border-b border-border px-5 py-2.5 text-xs font-medium text-muted sm:grid">
          <span>Description</span>
          <span>Qty</span>
          <span>Unit price</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        <ul className="divide-y divide-border">
          {items.fields.map((f, i) => (
            <li key={f.id} className="grid grid-cols-2 gap-3 px-5 py-3 sm:grid-cols-[1fr_100px_140px_120px_40px] sm:items-start">
              <div className="col-span-2 sm:col-span-1">
                <Input aria-label={`Item ${i + 1} description`} placeholder="Description" aria-invalid={!!itemError(i, "description")} {...form.register(`items.${i}.description`)} />
                {itemError(i, "description") && <p className="mt-1 text-xs text-danger">{itemError(i, "description")}</p>}
              </div>
              <div>
                <Input aria-label={`Item ${i + 1} quantity`} inputMode="decimal" aria-invalid={!!itemError(i, "quantity")} {...form.register(`items.${i}.quantity`)} />
                {itemError(i, "quantity") && <p className="mt-1 text-xs text-danger">{itemError(i, "quantity")}</p>}
              </div>
              <div>
                <Input aria-label={`Item ${i + 1} unit price`} inputMode="decimal" placeholder="0.00" aria-invalid={!!itemError(i, "unitPrice")} {...form.register(`items.${i}.unitPrice`)} />
                {itemError(i, "unitPrice") && <p className="mt-1 text-xs text-danger">{itemError(i, "unitPrice")}</p>}
              </div>
              <p className="self-center text-right text-sm tabular-nums">{totals?.lineAmounts[i] ? formatMoney(totals.lineAmounts[i], currency) : "—"}</p>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove item ${i + 1}`} disabled={items.fields.length === 1} onClick={() => items.remove(i)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-4 border-t border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={() => items.append({ description: "", quantity: "1", unitPrice: "" })} disabled={items.fields.length >= 100}>
              <Plus /> Add item
            </Button>
            {form.formState.errors.items?.root?.message && <p className="mt-2 text-xs text-danger">{form.formState.errors.items.root.message}</p>}
            {form.formState.errors.items?.message && <p className="mt-2 text-xs text-danger">{form.formState.errors.items.message}</p>}
          </div>
          <dl className="w-full max-w-xs text-sm">
            <div className="flex justify-between py-1">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums">{totals ? formatMoney(totals.subtotal, currency) : "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-1">
              <dt className="flex items-center gap-2 text-muted">
                <label htmlFor="taxRate">Tax %</label>
                <Input id="taxRate" inputMode="decimal" className="h-8 w-20" aria-invalid={!!errorOf(form, "taxRate")} {...form.register("taxRate")} />
              </dt>
              <dd className="tabular-nums">{totals ? formatMoney(totals.taxAmount, currency) : "—"}</dd>
            </div>
            {errorOf(form, "taxRate") && <p className="text-xs text-danger">{errorOf(form, "taxRate")}</p>}
            <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{totals ? formatMoney(totals.total, currency) : "—"}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card>
        <CardContent className="py-5">
          <Field label="Notes / payment instructions" htmlFor="notes" error={errorOf(form, "notes")} hint="Shown on the invoice and the PDF.">
            <Textarea rows={3} {...fieldProps(form, "notes")} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={form.formState.isSubmitting}>
          {invoiceId ? "Save invoice" : "Create draft invoice"}
        </Button>
      </div>
    </form>
  );
}
