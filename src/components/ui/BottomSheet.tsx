"use client";

import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableChildren(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("hidden") &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.getClientRects().length > 0,
  );
}

export function BottomSheet({
  open,
  onClose,
  children,
  ariaLabel = "Dialog",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const rememberOutsideFocus = (event: FocusEvent) => {
      if (
        !open &&
        event.target instanceof HTMLElement &&
        !event.target.closest('[role="dialog"]')
      ) {
        restoreFocusRef.current = event.target;
      }
    };
    if (!open && document.activeElement instanceof HTMLElement) {
      restoreFocusRef.current = document.activeElement;
    }
    document.addEventListener("focusin", rememberOutsideFocus);
    return () => document.removeEventListener("focusin", rememberOutsideFocus);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousFocus = activeElement && !dialog?.contains(activeElement)
      ? activeElement
      : restoreFocusRef.current;
    const previousBodyOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";

    const focusFrame = requestAnimationFrame(() => {
      if (!dialog || dialog.contains(document.activeElement)) return;
      const first = focusableChildren(dialog)[0];
      if (first) first.focus();
      else dialog.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = focusableChildren(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overscrollBehavior = previousOverscrollBehavior;
      previousFocus?.focus();
    };
  }, [open]);

  function handleDragEnd(_e: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 500) {
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]">
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 rounded-t-[28px] flex flex-col"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--surface-overlay) 96%, transparent), var(--surface))",
              boxShadow: "var(--elevation-3)",
              maxHeight: "85dvh",
              borderTop: "1px solid var(--surface-border-strong)",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
          >
            <div className="relative flex h-12 shrink-0 items-center justify-center">
              <div className="rounded-full" style={{ width: 42, height: 4, background: "var(--surface-border-strong)" }} />
              <button
                type="button"
                onClick={() => onCloseRef.current()}
                aria-label={`Close ${ariaLabel.toLowerCase()}`}
                className="absolute right-2 flex h-11 w-11 items-center justify-center rounded-full text-xl text-foreground-muted outline-none transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div
              className="p-6 overflow-y-auto"
              style={{
                paddingRight: "max(1.5rem, var(--safe-right))",
                paddingBottom: "max(1.5rem, var(--safe-bottom))",
                paddingLeft: "max(1.5rem, var(--safe-left))",
              }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
