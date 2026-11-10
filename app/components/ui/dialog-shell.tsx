"use client";

import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import X from "lucide-react/icons/x";

type DialogSize = "small" | "medium" | "large" | "review";
type DialogTone = "default" | "danger" | "warning" | "info";

type DialogShellProps = {
  children: ReactNode;
  className?: string;
  label: string;
  onClose: () => void;
  closeOnBackdrop?: boolean;
  showClose?: boolean;
  size?: DialogSize;
  tone?: DialogTone;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function DialogShell({
  children,
  className = "",
  label,
  onClose,
  closeOnBackdrop = true,
  showClose = true,
  size = "medium",
  tone = "default",
}: DialogShellProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const labelId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const dialog = dialogRef.current;
    const initialTarget =
      dialog?.querySelector<HTMLElement>("[autofocus]") ??
      dialog?.querySelector<HTMLElement>(focusableSelector) ??
      dialog;
    requestAnimationFrame(() => initialTarget?.focus());

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => !element.hasAttribute("hidden"));
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) onClose();
  };

  return (
    <div className='modal-backdrop' role='presentation' onMouseDown={handleBackdrop}>
      <section
        ref={dialogRef}
        className={`modal-card dialog-shell dialog-${size} dialog-tone-${tone} ${className}`.trim()}
        role='dialog'
        aria-modal='true'
        aria-labelledby={labelId}
        tabIndex={-1}
      >
        <span id={labelId} className='sr-only'>
          {label}
        </span>
        {showClose && (
          <button className='modal-close' type='button' aria-label='Close dialog' onClick={onClose}>
            <X aria-hidden='true' />
          </button>
        )}
        {children}
      </section>
    </div>
  );
}
