"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type EnsureResult = { form: HTMLFormElement; host: HTMLElement };

export default function ResumeStep3Template({
  children,
}: {
  children: ReactNode;
}) {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const hostRef = useRef<HTMLElement | null>(null);

  const syncCards = useCallback(() => {
    const form = formRef.current;
    if (!form) return;

    const nodes = Array.from(
      form.querySelectorAll<HTMLElement>("[data-education-card]")
    );

    const host = hostRef.current ??
      form.querySelector<HTMLElement>("#resume-step3-augment");

    if (host) {
      hostRef.current = host;
      host.dataset.educationCardCount = `${nodes.length}`;
    }
  }, []);

  const ensurePortalHost = useCallback((): EnsureResult | null => {
      const main = document.querySelector("main") ?? document.body;
      const form = (main?.querySelector("form") as HTMLFormElement | null) ?? null;
      if (!form) return null;

      formRef.current = form;
      neutralizeGuards(form);

      const hostId = "resume-step3-augment";
      let host = form.querySelector(`#${hostId}`) as HTMLElement | null;
      const createdHost = !host;

      if (!host) {
        host = document.createElement("div");
        host.id = hostId;
        host.style.marginTop = "16px";
        host.style.width = "100%";
      }

      const nativeAddButton = form.querySelector<HTMLButtonElement>(
        "button[data-education-add]"
      );

      if (nativeAddButton) {
        addButtonRef.current = nativeAddButton;
        const container = nativeAddButton.parentElement as HTMLElement | null;
        nativeAddButton.style.display = "none";
        if (container && createdHost) {
          container.insertAdjacentElement("afterend", host);
        } else if (createdHost) {
          nativeAddButton.insertAdjacentElement("afterend", host);
        }
      } else {
        addButtonRef.current = null;
        if (createdHost) {
          form.appendChild(host);
        }
      }

      hostRef.current = host;
      syncCards();

      return host ? { form, host } : null;
  }, [syncCards]);

  useEffect(() => {
    let cancelled = false;

    const initialize = (attempt = 0) => {
      if (cancelled) return;

      const ensured = ensurePortalHost();

      if (!ensured) {
        if (attempt < 10) {
          requestAnimationFrame(() => initialize(attempt + 1));
        }
        return;
      }

      const { form, host } = ensured;

      queueMicrotask(() => {
        if (!cancelled) {
          setPortalHost(host);
        }
      });
      requestAnimationFrame(syncCards);

      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      observerRef.current = new MutationObserver(() => {
        neutralizeGuards(form);
        const existingHost = form.querySelector<HTMLElement>("#resume-step3-augment");
        if (!existingHost) {
          const refreshed = ensurePortalHost();
          if (refreshed) {
            queueMicrotask(() => {
              if (!cancelled) {
                setPortalHost(refreshed.host);
              }
            });
          }
        }
        const nativeAddButton = form.querySelector<HTMLButtonElement>(
          "button[data-education-add]"
        );
        if (nativeAddButton) {
          nativeAddButton.style.display = "none";
          addButtonRef.current = nativeAddButton;
        } else {
          addButtonRef.current = null;
        }
        requestAnimationFrame(syncCards);
      });

      observerRef.current.observe(form, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    };

    initialize();

    return () => {
      cancelled = true;
      observerRef.current?.disconnect();
    };
  }, [ensurePortalHost, syncCards]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      formRef.current = null;
      addButtonRef.current = null;
      hostRef.current = null;
      if (portalHost?.parentElement) {
        portalHost.parentElement.removeChild(portalHost);
      }
    };
  }, [portalHost]);

  const handleAddCard = () => {
    if (addButtonRef.current) {
      addButtonRef.current.click();
      requestAnimationFrame(syncCards);
    }
  };

  return (
    <>
      {children}
      <style>{`
        main form label::before,
        main form label::after,
        main form [data-required="true"]::before,
        main form [data-required="true"]::after,
        main form .required::before,
        main form .required::after,
        main form .is-required::before,
        main form .is-required::after {
          content: none !important;
        }
      `}</style>
      {portalHost &&
        createPortal(
          <div className="resume-step3-augment">
            <style>{`
              .resume-step3-augment .add-button {
                width: 100%;
                border: 1px dashed var(--color-border, #94a3b8);
                background: #f1f5f9;
                color: var(--color-text, #1f2937);
                font-weight: 600;
                border-radius: 12px;
                padding: 12px;
                cursor: pointer;
              }
            `}</style>
            <section aria-label="学校情報">
              <button type="button" className="add-button" onClick={handleAddCard}>
                ＋ 学校を追加
              </button>
            </section>
          </div>,
          portalHost
        )}
    </>
  );
}

function neutralizeGuards(form: HTMLFormElement) {
  form.setAttribute("noValidate", "true");

  form.querySelectorAll("[required]").forEach((element) => {
    element.removeAttribute("required");
  });

  form.querySelectorAll("[aria-required='true']").forEach((element) => {
    element.setAttribute("aria-required", "false");
  });

  form.querySelectorAll("button[disabled], [aria-disabled='true']").forEach((element) => {
    element.removeAttribute("disabled");
    element.setAttribute("aria-disabled", "false");
    (element as HTMLElement).style.pointerEvents = "auto";
  });

  form.querySelectorAll("label, legend, .field-label, .FormLabel").forEach((element) => {
    element.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
        node.nodeValue = node.nodeValue.replace(/\s*[＊*]\s*$/, "");
      }
    });
  });

  form.querySelectorAll("*").forEach((element) => {
    const text = (element.textContent ?? "").trim();
    if (text === "必須" || text === "*" || text === "＊") {
      (element as HTMLElement).style.display = "none";
    }
  });
}
