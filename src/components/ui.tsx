import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export const fieldClass =
  "h-11 w-full min-w-0 rounded-lg border border-line bg-sheet px-3 text-sm text-ink outline-none placeholder:text-muted focus-visible:border-sea";

export const areaClass =
  "w-full min-w-0 rounded-lg border border-line bg-sheet px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus-visible:border-sea";

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

const VARIANTS = {
  primary: "bg-sun text-ink hover:brightness-95",
  ghost: "bg-transparent text-ink hover:bg-sea-soft",
  sea: "bg-ink text-sheet hover:brightness-125",
  sheet: "bg-sheet text-ink shadow-card hover:bg-sea-soft",
} as const;

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-40",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed inset-x-4 top-4 z-50 mx-auto max-h-[calc(100dvh-2rem)] w-auto max-w-lg overflow-y-auto rounded-2xl bg-sheet p-5 text-ink shadow-card focus:outline-none">
          <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-4 flex items-start justify-between gap-3 border-b border-line bg-sheet px-5 pt-5 pb-3">
            <div className="min-w-0">
              <Dialog.Title className="font-serif text-2xl">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-pretty text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-sea-soft hover:text-ink"
              aria-label="關閉"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
