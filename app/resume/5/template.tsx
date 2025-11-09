"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function ResumeStep5Template({
  children,
}: {
  children: ReactNode;
}) {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const hostRef = useRef<HTMLElement | null>(null);

  const neutralizeGuards = (form: HTMLFormElement) => {
    form.querySelectorAll("[required]").forEach((el) => {
      el.removeAttribute("required");
    });
    form.querySelectorAll("[aria-required='true']").forEach((el) => {
      el.setAttribute("aria-required", "false");
    });
    form.querySelectorAll("[data-required]").forEach((el) => {
      el.setAttribute("data-required", "false");
    });
    form.querySelectorAll("span[aria-hidden='true']").forEach((span) => {
      if ((span.textContent ?? "").trim().match(/^[*＊]$/)) {
        (span as HTMLElement).style.display = "none";
      }
    });
  };

  const enableActions = (root: ParentNode) => {
    root.querySelectorAll("[disabled]").forEach((el) => {
      el.removeAttribute("disabled");
      if (el instanceof HTMLElement) {
        el.style.pointerEvents = "auto";
        el.style.opacity = "1";
      }
    });
    root.querySelectorAll("[aria-disabled='true']").forEach((el) => {
      el.setAttribute("aria-disabled", "false");
      if (el instanceof HTMLElement) {
        el.style.pointerEvents = "auto";
        el.style.opacity = "1";
      }
    });
  };

  const ensureNextLink = (form: HTMLFormElement) => {
    const hostId = "resume5-next-link";
    let host = form.querySelector<HTMLElement>(`#${hostId}`);
    if (!host) {
      host = document.createElement("div");
      host.id = hostId;
      host.style.marginTop = "24px";
      form.appendChild(host);
    }
    hostRef.current = host;
    setPortalHost((prev) => (prev === host ? prev : host));

    const candidates = Array.from(form.querySelectorAll<HTMLElement>("button, a"));
    candidates.forEach((candidate) => {
      const label = (candidate.textContent ?? "").replace(/\s+/g, "");
      if (label.includes("次へ")) {
        candidate.style.display = "none";
      }
    });
  };

  const pillifySection = (section: HTMLElement) => {
    const inputs = Array.from(
      section.querySelectorAll<HTMLInputElement>("input[type='checkbox'], input[type='radio']")
    );
    if (!inputs.length) return;

    inputs.forEach((input) => {
      input.classList.add("r5-pill-input");
      const wrapLabel = input.closest<HTMLLabelElement>("label");
      if (wrapLabel) {
        wrapLabel.classList.add("r5-pill-label");
        const parent = wrapLabel.parentElement;
        if (parent instanceof HTMLElement) {
          parent.classList.add("r5-pillbox");
        }
      } else {
        if (!input.id) {
          input.id = `resume5-pill-${Math.random().toString(36).slice(2)}`;
        }
        const referenced = section.querySelector<HTMLLabelElement>(
          `label[for='${CSS.escape(input.id)}']`
        );
        if (referenced) {
          referenced.classList.add("r5-pill-label");
          const parent = referenced.parentElement;
          if (parent instanceof HTMLElement) {
            parent.classList.add("r5-pillbox");
          }
          if (input.parentElement !== referenced) {
            const wrapper = document.createElement("label");
            wrapper.className = "r5-pill-label";
            wrapper.htmlFor = input.id;
            while (referenced.firstChild) {
              wrapper.appendChild(referenced.firstChild);
            }
            referenced.replaceWith(wrapper);
            wrapper.insertBefore(input, wrapper.firstChild);
          }
        } else {
          const proxyLabel = document.createElement("label");
          proxyLabel.className = "r5-pill-label";
          proxyLabel.htmlFor = input.id;
          proxyLabel.textContent = input.value || "選択";
          input.insertAdjacentElement("afterend", proxyLabel);
          proxyLabel.appendChild(input);
          proxyLabel.parentElement?.classList.add("r5-pillbox");
        }
      }
    });

    const boxes = Array.from(section.querySelectorAll<HTMLElement>(".r5-pill-label"))
      .map((label) => label.parentElement)
      .filter((parent): parent is HTMLElement => Boolean(parent));
    if (boxes.length === 0) {
      section.classList.add("r5-pillbox");
    }

    section.dataset.r5Pills = "true";
  };

  useEffect(() => {
    const applyEnhancements = () => {
      const main = document.querySelector("main");
      const container = document.querySelector<HTMLElement>(".resume-step");
      const form =
        (container?.querySelector("form") as HTMLFormElement | null) ??
        (main?.querySelector("form") as HTMLFormElement | null) ??
        (document.querySelector("form") as HTMLFormElement | null);

      if (main instanceof HTMLElement) {
        main.style.display = "flex";
        main.style.justifyContent = "center";
        main.style.padding = "32px 16px";
        main.style.boxSizing = "border-box";
      }

      if (container) {
        container.style.margin = "0 auto";
        container.style.width = "100%";
        container.style.maxWidth = "720px";
        container.style.padding = "24px";
        container.style.boxSizing = "border-box";
      }

      if (!form) return;

      form.noValidate = true;
      form.style.width = "100%";
      form.style.maxWidth = "720px";
      form.style.margin = "0 auto";
      form.style.padding = "24px 0 48px";
      form.style.boxSizing = "border-box";

      neutralizeGuards(form);
      enableActions(form);
      ensureNextLink(form);

      ["希望勤務地", "希望職種", "希望業界"].forEach((label) => {
        const headings = Array.from(
          document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")
        ).filter((el) => (el.textContent ?? "").includes(label));
        headings.forEach((heading) => {
          const section = heading.closest<HTMLElement>("section, div, fieldset, form");
          if (section) {
            pillifySection(section);
          }
        });
      });
    };

    applyEnhancements();

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new MutationObserver(() => {
      applyEnhancements();
    });

    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (hostRef.current?.parentElement) {
        hostRef.current.parentElement.removeChild(hostRef.current);
      }
    };
  }, []);
  return (
    <>
      {children}
      <style>{`
        main form label::after,
        main form [data-required='true']::after,
        main form .required::after,
        main form .is-required::after {
          content: none !important;
        }
        .r5-pillbox {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }
        .r5-pill-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 9999px;
          border: 1px solid var(--color-border, #d1d5db);
          background: #ffffff;
          color: var(--color-text, #1f2937);
          cursor: pointer;
          user-select: none;
          position: relative;
          transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }
        .r5-pill-input {
          position: absolute;
          opacity: 0;
          width: 1px;
          height: 1px;
          pointer-events: none;
        }
        .r5-pill-label:has(.r5-pill-input:checked),
        .r5-pill-input:checked + .r5-pill-label {
          background: var(--color-primary, #2563eb);
          border-color: var(--color-primary, #2563eb);
          color: #ffffff;
        }
        .r5-pill-label:focus-within {
          outline: 2px solid var(--color-primary, #2563eb);
          outline-offset: 2px;
        }
        .resume5-next-link {
          display: block;
          width: 100%;
          text-align: center;
          text-decoration: none;
          padding: 14px 0;
          border-radius: 10px;
          background: var(--color-primary, #2563eb);
          color: #ffffff;
          font-weight: 600;
        }
      `}</style>
      {portalHost &&
        createPortal(
          <a href="/cv/2" className="resume5-next-link">
            次へ
          </a>,
          portalHost
        )}
    </>
  );
}
