"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Banknote } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { errorOf, Field, FormGrid, fieldProps, useActionSubmit } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { paymentMethodEnum } from "@/db/schema/enums";
import { todayISO } from "@/lib/dates";
import { humanize } from "@/lib/utils";
import { paymentSchema } from "@/lib/validations/entities";
import { deleteInvoiceAction, recordPaymentAction, setInvoiceStatusAction } from "@/server/actions/business";

export function RecordPaymentButton({ invoiceId, balance }: { invoiceId: string; balance: string }) {
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { invoiceId, amount: balance, paidOn: todayISO(), method: "BANK_TRANSFER", reference: "", notes: "" },
  });
  const onSubmit = useActionSubmit(form, recordPaymentAction, { success: "Payment recorded.", onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Banknote /> Record payment
        </Button>
      </DialogTrigger>
      <DialogContent title="Record a payment" description={`Outstanding balance: ${balance}. Payments are recorded manually — no card is charged.`}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormGrid>
            <Field label="Amount" htmlFor="amount" error={errorOf(form, "amount")} required>
              <Input inputMode="decimal" {...fieldProps(form, "amount")} />
            </Field>
            <Field label="Paid on" htmlFor="paidOn" error={errorOf(form, "paidOn")} required>
              <Input type="date" {...fieldProps(form, "paidOn")} />
            </Field>
            <Field label="Method" htmlFor="method" error={errorOf(form, "method")}>
              <Select {...fieldProps(form, "method")}>
                {paymentMethodEnum.enumValues.map((m) => (
                  <option key={m} value={m}>
                    {humanize(m)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reference" htmlFor="reference" error={errorOf(form, "reference")}>
              <Input {...fieldProps(form, "reference")} placeholder="e.g. bank ref" />
            </Field>
          </FormGrid>
          <Button type="submit" className="self-end" loading={form.formState.isSubmitting}>
            Record payment
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function InvoiceStatusButtons({ id, status, hasPayments }: { id: string; status: string; hasPayments: boolean }) {
  return (
    <>
      {status === "DRAFT" && (
        <>
          <ConfirmButton
            variant="secondary"
            action={() => deleteInvoiceAction({ id })}
            title="Delete draft?"
            description="This draft invoice will be removed. Its number will not be reused."
            confirmLabel="Delete draft"
            success="Draft deleted."
            redirectTo="/app/invoices"
          >
            Delete
          </ConfirmButton>
          <ConfirmButton
            tone="primary"
            action={() => setInvoiceStatusAction({ id, status: "SENT" })}
            title="Mark as sent?"
            description="The invoice becomes visible in the client’s portal and their users are notified. Sent invoices can’t be edited."
            confirmLabel="Mark as sent"
            success="Invoice sent."
          >
            Send to client
          </ConfirmButton>
        </>
      )}
      {status === "SENT" && !hasPayments && (
        <ConfirmButton
          variant="secondary"
          tone="primary"
          action={() => setInvoiceStatusAction({ id, status: "DRAFT" })}
          title="Return to draft?"
          description="The invoice will be hidden from the client portal so you can edit it."
          confirmLabel="Return to draft"
          success="Invoice returned to draft."
        >
          Edit as draft
        </ConfirmButton>
      )}
      {["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(status) && (
        <ConfirmButton
          variant="secondary"
          action={() => setInvoiceStatusAction({ id, status: "CANCELLED" })}
          title="Cancel invoice?"
          description="The invoice will be marked as cancelled. Recorded payments are kept."
          confirmLabel="Cancel invoice"
          success="Invoice cancelled."
        >
          Cancel invoice
        </ConfirmButton>
      )}
    </>
  );
}
