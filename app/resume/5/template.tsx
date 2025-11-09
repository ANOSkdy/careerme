"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type TemplateProps = {
  children: ReactNode;
};

export default function ResumeStep5Template({ children }: TemplateProps) {
  const [nextHost, setNextHost] = useState<HTMLElement | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>(".resume-step form");
    if (!form) return;

    form.setAttribute("noValidate", "true");
    form.classList.add("r5-enhanced-form");

    const resumeStep = form.closest<HTMLElement>(".resume-step");
    resumeStep?.classList.add("r5-enhanced-step");

    const main = form.closest<HTMLElement>("main");
    main?.classList.add("r5-enhanced-main");

    const removeGuards = () => {
      form.querySelectorAll("[required]").forEach((el) => el.removeAttribute("required"));
      form
        .querySelectorAll("[aria-required='true']")
        .forEach((el) => el.setAttribute("aria-required", "false"));
      form
        .querySelectorAll<HTMLElement>("button[disabled], input[disabled], select[disabled], textarea[disabled]")
        .forEach((el) => {
          el.removeAttribute("disabled");
          el.style.pointerEvents = "auto";
          el.style.opacity = "";
        });
      form.querySelectorAll<HTMLElement>("[aria-disabled='true']").forEach((el) => {
        el.setAttribute("aria-disabled", "false");
        el.style.pointerEvents = "auto";
        el.style.opacity = "";
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
      const controls = Array.from(form.querySelectorAll<HTMLElement>("a, button"));
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

    removeGuards();
    hideNativeNext();

    const host = document.createElement("div");
    host.className = "r5-next-host";
    form.appendChild(host);
    const hostTimeout = window.setTimeout(() => {
      setNextHost(host);
    }, 0);

    observerRef.current?.disconnect();
    observerRef.current = new MutationObserver(() => {
      removeGuards();
      hideNativeNext();
    });
    observerRef.current.observe(form, {
      subtree: true,
      childList: true,
      attributes: true,
    });

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      clearTimeout(hostTimeout);
      host.remove();
    };
  }, []);

  return (
    <>
      {children}
      <style>{`
        .r5-enhanced-main {
          display: flex;
          justify-content: center;
          padding: 32px 16px;
          box-sizing: border-box;
        }

        .r5-enhanced-step {
          width: 100%;
          max-width: 720px;
          margin: 0 auto;
          padding: 24px;
          box-sizing: border-box;
        }

        .r5-enhanced-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 100%;
        }

        .r5-enhanced-form .resume-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .r5-enhanced-form .step-nav {
          margin-top: 24px;
        }

        .r5-enhanced-form label::after,
        .r5-enhanced-form .required::after,
        .r5-enhanced-form .is-required::after {
          content: none !important;
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
          display: inline-block;
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

        .resume-step .modal-option span {
          min-width: 72px;
          text-align: center;
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
