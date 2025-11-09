"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const TARGET_LABELS = ["希望勤務地", "希望職種", "希望業界"];

export default function Template({ children }: { children: ReactNode }) {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const hostRef = useRef<HTMLElement | null>(null);
  const formObserverRef = useRef<MutationObserver | null>(null);
  const bodyObserverRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    const main = document.querySelector("main");
    const container = document.querySelector<HTMLElement>(".resume-step");
    const form = container?.querySelector("form");

    if (!container || !(form instanceof HTMLFormElement)) {
      return;
    }

    const applyLayout = () => {
      if (main instanceof HTMLElement) {
        main.style.display = "flex";
        main.style.justifyContent = "center";
        main.style.padding = "32px 16px";
        main.style.boxSizing = "border-box";
      }
      container.style.margin = "0 auto";
      container.style.width = "100%";
      container.style.maxWidth = "720px";
      container.style.padding = "24px";
      container.style.boxSizing = "border-box";

      form.style.width = "100%";
      form.style.maxWidth = "720px";
      form.style.margin = "0 auto";
      form.style.padding = "24px 0 48px";
      form.style.boxSizing = "border-box";
      form.setAttribute("noValidate", "true");
    };

    const neutralizeGuards = () => {
      form.querySelectorAll("[required]").forEach((el) => el.removeAttribute("required"));
      form
        .querySelectorAll<HTMLElement>("[aria-required='true']")
        .forEach((el) => el.setAttribute("aria-required", "false"));
      form
        .querySelectorAll<HTMLElement>("span, strong, em, p")
        .forEach((el) => {
          const text = el.textContent?.trim();
          if (text === "必須" || text === "*" || text === "＊") {
            el.style.display = "none";
          }
        });
    };

    const enableActions = () => {
      form.querySelectorAll("button[disabled], [aria-disabled='true'], input[disabled]").forEach((el) => {
        el.removeAttribute("disabled");
        el.setAttribute("aria-disabled", "false");
        if (el instanceof HTMLElement) {
          el.style.pointerEvents = "auto";
          el.style.opacity = "1";
        }
      });
    };

    const findContext = (input: HTMLInputElement) => {
      const modalDialog = input.closest(".modal__dialog");
      if (modalDialog instanceof HTMLElement) {
        const title = modalDialog.querySelector(".modal__title")?.textContent?.trim() ?? "";
        if (TARGET_LABELS.some((label) => title.includes(label))) {
          return modalDialog;
        }
      }
      const section = input.closest("section, fieldset");
      if (section instanceof HTMLElement) {
        const heading = section.querySelector("h1, h2, h3, legend")?.textContent?.trim() ?? "";
        if (TARGET_LABELS.some((label) => heading.includes(label))) {
          return section;
        }
      }
      return null;
    };

    const stylePills = () => {
      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>("input[type='checkbox'], input[type='radio']")
      );
      inputs.forEach((input) => {
        if (input.dataset.r5Pillified === "true") {
          return;
        }
        const context = findContext(input);
        if (!context) {
          return;
        }
        const label = input.closest("label") || (input.id ? document.querySelector(`label[for='${input.id}']`) : null);
        if (!(label instanceof HTMLElement)) {
          return;
        }
        input.dataset.r5Pillified = "true";
        input.classList.add("r5-pill-input");
        label.classList.add("r5-pill");
        label.setAttribute("data-r5-pill", "true");
        const textEl = label.querySelector("span, .modal-option__label");
        if (textEl instanceof HTMLElement) {
          textEl.classList.add("r5-pill-text");
        }
        const list =
          input.closest<HTMLElement>(".modal-list, .r5-pillbox") ||
          (label.parentElement instanceof HTMLElement ? label.parentElement : null);
        if (list instanceof HTMLElement) {
          list.classList.add("r5-pillbox");
        }
      });
    };

    const hideNativeNext = () => {
      form.querySelectorAll<HTMLElement>("a, button").forEach((el) => {
        if (el.dataset.r5Injected === "true") {
          return;
        }
        const text = el.textContent?.trim();
        if (text === "次へ") {
          el.style.display = "none";
        }
      });
    };

    const runAll = () => {
      applyLayout();
      neutralizeGuards();
      enableActions();
      stylePills();
      hideNativeNext();
    };

    runAll();

    if (!hostRef.current) {
      const host = document.createElement("div");
      host.id = "resume5-next-link";
      host.style.marginTop = "16px";
      form.appendChild(host);
      hostRef.current = host;
      queueMicrotask(() => setPortalHost(host));
    }

    formObserverRef.current?.disconnect();
    formObserverRef.current = new MutationObserver(runAll);
    formObserverRef.current.observe(form, { childList: true, subtree: true, attributes: true });

    bodyObserverRef.current?.disconnect();
    bodyObserverRef.current = new MutationObserver(stylePills);
    bodyObserverRef.current.observe(document.body, { childList: true, subtree: true });

    return () => {
      formObserverRef.current?.disconnect();
      bodyObserverRef.current?.disconnect();
      if (hostRef.current?.parentElement) {
        hostRef.current.parentElement.removeChild(hostRef.current);
      }
      hostRef.current = null;
      queueMicrotask(() => setPortalHost(null));
    };
  }, []);

  return (
    <>
      {children}
      <style>{`
        .resume-step form label::after,
        .resume-step form .required::after,
        .resume-step form .is-required::after,
        .resume-step form [data-required='true']::after {
          content: none !important;
        }
        .resume-step {
          width: 100%;
        }
        .r5-pillbox {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }
        .r5-pill {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 9999px;
          border: 1px solid var(--color-border, #cbd5e1);
          padding: 8px 16px;
          background: #fff;
          color: var(--color-text, #1f2937);
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }
        .r5-pill-text {
          pointer-events: none;
        }
        .r5-pill-input {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          clip: rect(0 0 0 0);
          overflow: hidden;
          opacity: 0;
        }
        .r5-pill:has(.r5-pill-input:checked) {
          background: var(--color-primary, #3A75C4);
          color: #fff;
          border-color: transparent;
        }
        .r5-pill:has(.r5-pill-input:focus-visible) {
          outline: 2px solid var(--color-primary, #3A75C4);
          outline-offset: 2px;
        }
        .r5-pill:has(.r5-pill-input:disabled) {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .r5-next-link {
          display: block;
          width: 100%;
          text-align: center;
          padding: 12px 0;
          border-radius: 10px;
          background: var(--color-primary, #3A75C4);
          color: #fff;
          font-weight: 700;
          text-decoration: none;
        }
      `}</style>
      {portalHost &&
        createPortal(
          <a href="/cv/2" className="r5-next-link" data-r5-injected="true">
            次へ
          </a>,
          portalHost
        )}
    </>
  );
}
