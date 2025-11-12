"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FINAL_EDUCATION_OPTIONS = [
  "院卒",
  "大卒",
  "短大",
  "専門",
  "高専",
  "高卒",
  "その他",
] as const;

type SchoolCard = { id: string };
type EnsureResult = { form: HTMLFormElement; host: HTMLElement };

export default function ResumeStep3Template({
  children,
}: {
  children: ReactNode;
}) {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [cards, setCards] = useState<SchoolCard[]>([]);
  const observerRef = useRef<MutationObserver | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);

  const syncCards = useCallback(() => {
    const form = formRef.current;
    if (!form) return;

    const nodes = Array.from(
      form.querySelectorAll<HTMLElement>("[data-education-card]")
    );

    setCards((prev) => {
      const next = nodes.map((node, index) => ({
        id: node.dataset.educationCardId ?? `${index}`,
      }));

      if (
        next.length === prev.length &&
        next.every((card, index) => card.id === prev[index]?.id)
      ) {
        return prev;
      }

      return next;
    });
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
        if (container) {
          //container.style.display = "none";
          if (createdHost) {
            container.insertAdjacentElement("afterend", host);
          }
        } else if (createdHost) {
          nativeAddButton.insertAdjacentElement("afterend", host);
        }
      } else {
        addButtonRef.current = null;
        if (createdHost) {
          form.appendChild(host);
        }
      }

      const finalEducationSection = form.querySelector(".final-education") as HTMLElement | null;
      if (finalEducationSection) {
        finalEducationSection.style.display = "none";
      }

      const stepNav = form.querySelector(".step-nav") as HTMLElement | null;
      if (stepNav) {
        stepNav.style.display = "none";
      }

      syncCards();

      return host ? { form, host } : null;
  }, [syncCards]);

  useEffect(() => {
    const ensured = ensurePortalHost();
    if (!ensured) return;
    const { form, host } = ensured;
    queueMicrotask(() => setPortalHost(host));
    queueMicrotask(syncCards);

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new MutationObserver(() => {
      neutralizeGuards(form);
      const existingHost = form.querySelector<HTMLElement>("#resume-step3-augment");
      if (!existingHost) {
        const refreshed = ensurePortalHost();
        if (refreshed) {
          queueMicrotask(() => setPortalHost(refreshed.host));
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
      const finalEducationSection = form.querySelector(".final-education") as HTMLElement | null;
      if (finalEducationSection) {
        finalEducationSection.style.display = "none";
      }
      const stepNav = form.querySelector(".step-nav") as HTMLElement | null;
      if (stepNav) {
        stepNav.style.display = "none";
      }
      syncCards();
    });

    observerRef.current.observe(form, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [ensurePortalHost, syncCards]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      formRef.current = null;
      addButtonRef.current = null;
      if (portalHost?.parentElement) {
        portalHost.parentElement.removeChild(portalHost);
      }
    };
  }, [portalHost]);

  const handleAddCard = () => {
    if (addButtonRef.current) {
      addButtonRef.current.click();
      queueMicrotask(syncCards);
      return;
    }

    setCards((prev) => [
      ...prev,
      { id: `${Date.now() + Math.random()}` },
    ]);
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
              .resume-step3-augment .section {
                margin-top: 20px;
              }
              .resume-step3-augment h2 {
                font-size: 1rem;
                font-weight: 600;
                margin-bottom: 12px;
              }
              .resume-step3-augment .radio-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
              }
              .resume-step3-augment .radio-pill {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 10px 18px;
                border-radius: 9999px;
                border: 1px solid var(--color-border, #d1d5db);
                background: #ffffff;
                color: var(--color-text, #1f2937);
                cursor: pointer;
                transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
              }
              .resume-step3-augment .radio-input {
                position: absolute;
                opacity: 0;
                width: 0;
                height: 0;
              }
              .resume-step3-augment .radio-input:focus-visible + .radio-pill {
                outline: 2px solid var(--color-primary, #2563eb);
                outline-offset: 2px;
              }
              .resume-step3-augment .radio-input:checked + .radio-pill {
                background: var(--color-primary, #2563eb);
                border-color: var(--color-primary, #2563eb);
                color: #ffffff;
              }
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
              .resume-step3-augment .cards {
                display: grid;
                gap: 12px;
                margin-top: 12px;
              }
              .resume-step3-augment .card {
                border: 1px solid var(--color-border, #e2e8f0);
                border-radius: 16px;
                padding: 16px;
                background: #ffffff;
                display: grid;
                gap: 12px;
              }
              .resume-step3-augment .field {
                display: grid;
                gap: 4px;
              }
              .resume-step3-augment .field label {
                font-size: 0.875rem;
                color: var(--color-text-secondary, #475569);
              }
              .resume-step3-augment .field input,
              .resume-step3-augment .field select {
                border: 1px solid var(--color-border, #cbd5f5);
                border-radius: 10px;
                padding: 10px 12px;
                font-size: 0.95rem;
              }
              .resume-step3-augment .field-row {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                gap: 12px;
              }
              .resume-step3-augment .next-link {
                display: block;
                margin-top: 24px;
                text-align: center;
                border-radius: 12px;
                padding: 12px;
                background: var(--color-primary, #2563eb);
                color: #ffffff;
                font-weight: 700;
                text-decoration: none;
              }
            `}</style>

            <section className="section" aria-label="最終学歴">
              <h2>最終学歴</h2>
              <div className="radio-grid">
                {FINAL_EDUCATION_OPTIONS.map((option) => {
                  const id = `final-edu-${option}`;
                  return (
                    <div key={option}>
                      <input
                        id={id}
                        className="radio-input"
                        type="radio"
                        name="finalEdu"
                        value={option}
                      />
                      <label className="radio-pill" htmlFor={id}>
                        {option}
                      </label>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="section" aria-label="学校情報">
              <button type="button" className="add-button" onClick={handleAddCard}>
                ＋ 学校を追加
              </button>
              <div className="cards">
                {cards.map((card, index) => (
                  <div className="card" key={card.id}>
                    <div className="field">
                      <label htmlFor={`school-name-${card.id}`}>学校名</label>
                      <input
                        id={`school-name-${card.id}`}
                        name={`schools[${index}][name]`}
                        type="text"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`school-dept-${card.id}`}>学部・学科</label>
                      <input
                        id={`school-dept-${card.id}`}
                        name={`schools[${index}][department]`}
                        type="text"
                      />
                    </div>
                    <div className="field-row">
                      <div className="field">
                        <label htmlFor={`school-start-${card.id}`}>入学年月</label>
                        <input
                          id={`school-start-${card.id}`}
                          name={`schools[${index}][start]`}
                          type="month"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`school-end-${card.id}`}>卒業(予定)年月</label>
                        <input
                          id={`school-end-${card.id}`}
                          name={`schools[${index}][end]`}
                          type="month"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <a href="/resume/4" className="next-link">
              次へ
            </a>
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
