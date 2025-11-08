"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  labelledBy?: string;
  descriptionId?: string;
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  labelledBy,
  descriptionId,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElement = useRef<Element | null>(null);

  const focusableSelectors = useMemo(
    () =>
      [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(","),
    []
  );

  useEffect(() => {
    if (open) {
      previouslyFocusedElement.current = document.activeElement;
      const container = dialogRef.current;
      if (!container) return;
      const focusable = container.querySelectorAll<HTMLElement>(focusableSelectors);
      if (focusable.length > 0) {
        focusable[0]?.focus();
      } else {
        container.focus();
      }
      return;
    }
    const previous = previouslyFocusedElement.current as HTMLElement | null;
    if (previous) {
      previous.focus();
    }
  }, [open, focusableSelectors]);

  useEffect(() => {
    if (!open) return undefined;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Tab") return;
      const container = dialogRef.current;
      if (!container) return;
      const focusable = container.querySelectorAll<HTMLElement>(focusableSelectors);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [focusableSelectors]
  );

  if (!open) return null;

  const labelledById = labelledBy || (title ? "modal-title" : undefined);

  return (
    <div className="modal" role="presentation">
      <div className="modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledById}
        aria-describedby={descriptionId}
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="modal__header">
          {title ? (
            <h2 id={labelledById} className="modal__title">
              {title}
            </h2>
          ) : null}
          <button type="button" className="modal__close" onClick={onClose}>
            閉じる
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
