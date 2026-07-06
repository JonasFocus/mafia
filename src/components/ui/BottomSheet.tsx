"use client";

import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import type { ReactNode } from "react";

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
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
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 rounded-t-[28px] flex flex-col"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--surface-overlay) 96%, transparent), var(--surface))",
              boxShadow: "var(--elevation-3)",
              maxHeight: "85vh",
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
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="rounded-full" style={{ width: 42, height: 4, background: "var(--surface-border-strong)" }} />
            </div>
            <div className="p-6 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
