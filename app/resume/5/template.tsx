"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type TemplateProps = {
  children: ReactNode;
};

export default function Template({ children }: TemplateProps) {
  const [nextHost, setNextHost] = useState<HTMLElement | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const hostRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let rafId: number | null = null;

    let form: HTMLFormElement | null = null;
    let main: HTMLElement | null = null;
    let resumeStep: HTMLElement | null = null;

    const findForm = (): HTMLFormElement | null =>
      document.querySelector<HTMLFormElement>(".resume-step form") ??
      document.querySelector<HTMLFormElement>("main form") ??
      document.querySelector<HTMLFormElement>("form");

    const ensureTargets = () => {
      if (!form) return;
      main = form.closest<HTMLElement>("main") ?? (document.querySelector("main") as HTMLElement | null);
      resumeStep = form.closest<HTMLElement>(".resume-step") ?? form.parentElement;
    };

    const removeGuards = () => {
      if (!form) return;
      form.setAttribute("noValidate", "true");
      form.querySelectorAll("[required]").forEach((el) => el.removeAttribute("required"));
      form
        .querySelectorAll("[aria-required='true']")
        .forEach((el) => el.setAttribute("aria-required", "false"));
      form
        .querySelectorAll<HTMLElement>("button[disabled], input[disabled], select[disabled], textarea[disabled]")
        .forEach((el) => {
          el.removeAttribute("disabled");
          el.style.pointerEvents = "auto";
          el.style.opacity = "1";
        });
      form.querySelectorAll<HTMLElement>("[aria-disabled='true']").forEach((el) => {
        el.setAttribute("aria-disabled", "false");
        el.style.pointerEvents = "auto";
        el.style.opacity = "1";
      });
      form.querySelectorAll<HTMLElement>("[tabindex='-1']").forEach((el) => {
        el.removeAttribute("tabindex");
      });
      form.querySelectorAll(".is-disabled").forEach((el) => el.classList.remove("is-disabled"));
      form.querySelectorAll<HTMLElement>("*").forEach((el) => {
        const text = el.textContent?.trim();
        if (text === "必須" || text === "*" || text === "＊") {
          el.style.display = "none";
        }
      });
    };

    const hideNativeNext = () => {
      const controls = Array.from(document.querySelectorAll<HTMLElement>("a, button"));
      controls
        .filter((el) => {
          if (el.dataset.r5Next === "true") return false;
          const text = el.textContent?.replace(/\s+/g, "") ?? "";
          return text.includes("次へ");
        })
        .forEach((el) => {
          el.style.display = "none";
        });
    };

    const ensureHost = () => {
      if (!form) return;
      if (hostRef.current && !hostRef.current.isConnected) {
        hostRef.current = null;
        setNextHost(null);
      }
      if (!hostRef.current) {
        const existing = form.querySelector<HTMLElement>("#resume-step5-next");
        const host = existing ?? document.createElement("div");
        if (!existing) {
          host.id = "resume-step5-next";
          host.className = "r5-next-host";
          form.appendChild(host);
        }
        hostRef.current = host;
        setNextHost(host);
      }
    };

    const applyEnhancements = () => {
      if (!form) return;
      main?.classList.add("r5-enhanced-main");
      resumeStep?.classList.add("r5-enhanced-step");
      form.classList.add("r5-enhanced-form");
      removeGuards();
      hideNativeNext();
      ensureHost();
    };

    const boot = () => {
      if (cancelled) return;
      form = findForm();
      if (!form) {
        rafId = window.requestAnimationFrame(boot);
        return;
      }

      ensureTargets();
      if (form.dataset.r5Enhanced !== "true") {
        form.dataset.r5Enhanced = "true";
      }

      applyEnhancements();

      observerRef.current?.disconnect();
      observerRef.current = new MutationObserver(() => {
        applyEnhancements();
      });
      observerRef.current.observe(form, {
        subtree: true,
        childList: true,
        attributes: true,
      });
    };

    boot();

    return () => {
      cancelled = true;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (hostRef.current?.parentElement) {
        hostRef.current.parentElement.removeChild(hostRef.current);
      }
      hostRef.current = null;
      setNextHost(null);
    };
  }, []);

  return (
    <>
      {children}
      <style>{`
        .r5-enhanced-main {
          display: flex !important;
          justify-content: center !important;
          padding: 32px 16px !important;
          box-sizing: border-box !important;
        }

        .r5-enhanced-step {
          width: 100%;
          max-width: 720px;
          margin: 0 auto;
          padding: 0 0 48px;
          box-sizing: border-box;
        }

        .r5-enhanced-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 100%;
          max-width: 720px;
          margin: 0 auto;
          padding: 24px 0 0;
          box-sizing: border-box;
        }

        .r5-enhanced-form .resume-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .r5-enhanced-form label::after,
        .r5-enhanced-form .required::after,
        .r5-enhanced-form .is-required::after {
          content: none !important;
        }

        .r5-enhanced-form .step-nav__button--primary {
          display: none !important;
        }

        .resume-step .modal-list {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .resume-step .modal-option {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .resume-step .modal-option input {
          position: absolute;
          inset: 0;
          opacity: 0;
          pointer-events: none;
        }

        .resume-step .modal-option span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 72px;
          padding: 8px 16px;
          border-radius: 9999px;
          border: 1px solid var(--color-border, #cbd5e1);
          background: #ffffff;
          color: var(--color-text, #1f2933);
          transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }

        .resume-step .modal-option input:checked + span {
          background: var(--color-primary, #2563eb);
          color: #ffffff;
          border-color: var(--color-primary, #2563eb);
        }

        .resume-step .modal-option input:focus-visible + span {
          outline: 2px solid var(--color-primary, #2563eb);
          outline-offset: 2px;
        }

        .resume-step .modal-option span::after {
          content: attr(data-badge);
        }

        .r5-next-host {
          margin-top: 16px;
        }

        .r5-next-button {
          display: block;
          width: 100%;
          text-align: center;
          padding: 12px;
          border-radius: 12px;
          background: var(--color-primary, #2563eb);
          color: #ffffff;
          font-weight: 700;
          text-decoration: none;
        }

        .r5-next-button:focus-visible {
          outline: 2px solid var(--color-primary, #2563eb);
          outline-offset: 2px;
        }
      `}</style>
      {nextHost &&
        createPortal(
          <a href="/cv/2" className="r5-next-button" data-r5-next="true">
            次へ
          </a>,
          nextHost
        )}
    </>
  );
}
