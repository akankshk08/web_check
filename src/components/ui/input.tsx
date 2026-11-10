import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground shadow-xs placeholder:text-muted/70 transition-colors focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-subtle aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, "h-9", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 4, ...props }, ref) => <textarea ref={ref} rows={rows} className={cn(fieldBase, "py-2 leading-relaxed", className)} {...props} />,
);
Textarea.displayName = "Textarea";

/** Native select: accessible, keyboard friendly and works with forms without extra JS. */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        fieldBase,
        "h-9 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%23697386%22 stroke-width=%222%22 viewBox=%220 0 24 24%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_10px_center] bg-no-repeat pr-8",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[13px] font-medium text-foreground", className)} {...props} />;
}

export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={cn("size-4 rounded border-border accent-primary", className)} {...props} />;
}
