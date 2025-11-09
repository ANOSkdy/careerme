'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export default function Template({ children }: { children: ReactNode }) {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    main.classList.add('r5-shell');

    const form = main.querySelector('form');
    if (!form) return;

    form.setAttribute('novalidate', 'true');

    const removeRequiredBadges = () => {
      const candidates = form.querySelectorAll<HTMLElement>('span, strong, em, small, sup');
      candidates.forEach((node) => {
        if (node.textContent?.trim() === '必須') {
          node.style.display = 'none';
        }
      });
    };

    const releaseButtons = () => {
      form.querySelectorAll<HTMLButtonElement>('button[disabled]').forEach((button) => {
        button.disabled = false;
        button.setAttribute('aria-disabled', 'false');
        button.classList.remove('is-disabled');
      });
    };

    const hideNativeNext = () => {
      const nextButtons = form.querySelectorAll<HTMLElement>('.step-nav__button--primary');
      nextButtons.forEach((element) => {
        if (!(element.textContent || '').includes('次へ')) return;
        if (element instanceof HTMLButtonElement) {
          element.disabled = false;
        } else if (element instanceof HTMLAnchorElement) {
          element.setAttribute('aria-disabled', 'false');
          element.removeAttribute('tabindex');
        }
        element.classList.remove('is-disabled');
        element.style.setProperty('display', 'none', 'important');
      });
    };

    const ensureHost = () => {
      if (!hostRef.current) {
        hostRef.current = document.createElement('div');
        hostRef.current.className = 'r5-next-container';
        form.appendChild(hostRef.current);
        setPortalHost(hostRef.current);
      } else if (!form.contains(hostRef.current)) {
        form.appendChild(hostRef.current);
      }
    };

    const neutralizeControls = () => {
      form
        .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')
        .forEach((input) => {
          if (input.hasAttribute('required')) {
            input.removeAttribute('required');
          }
          if (input.getAttribute('aria-required') === 'true') {
            input.setAttribute('aria-required', 'false');
          }
        });
      removeRequiredBadges();
      releaseButtons();
      hideNativeNext();
      ensureHost();
    };

    neutralizeControls();

    observerRef.current?.disconnect();
    observerRef.current = new MutationObserver(() => {
      neutralizeControls();
    });
    observerRef.current.observe(form, { childList: true, subtree: true, attributes: true });

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (hostRef.current?.parentElement) {
        hostRef.current.parentElement.removeChild(hostRef.current);
      }
      hostRef.current = null;
      setPortalHost(null);
      main.classList.remove('r5-shell');
    };
  }, []);

  return (
    <>
      {children}
      <style>{`
        main.r5-shell {
          max-width: 40rem;
          margin: 0 auto;
          padding: 2rem 1rem;
          width: 100%;
          box-sizing: border-box;
        }

        main.r5-shell form label::after,
        main.r5-shell form [data-required="true"]::after,
        main.r5-shell form .required::after,
        main.r5-shell form .is-required::after {
          content: none !important;
        }

        main.r5-shell .modal-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        main.r5-shell .modal-option {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          padding: 0;
        }

        main.r5-shell .modal-option input[type="checkbox"],
        main.r5-shell .modal-option input[type="radio"] {
          position: absolute;
          inset: 0;
          opacity: 0;
          pointer-events: none;
        }

        main.r5-shell .modal-option span {
          display: inline-block;
          padding: 0.5rem 1rem;
          border-radius: 9999px;
          border: 1px solid var(--color-border, #d1d5db);
          background: #ffffff;
          color: var(--color-text-strong, #111827);
          font-weight: 600;
          font-size: 0.95rem;
          transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        main.r5-shell .modal-option input:checked + span {
          background: var(--color-primary, #3a75c4);
          color: #ffffff;
          border-color: var(--color-primary, #3a75c4);
          box-shadow: 0 0 0 1px rgba(58, 117, 196, 0.35);
        }

        main.r5-shell .modal-option input:focus-visible + span {
          outline: 2px solid rgba(58, 117, 196, 0.5);
          outline-offset: 2px;
        }

        main.r5-shell .modal-option.is-disabled span {
          opacity: 0.5;
        }

        .r5-next-container {
          margin-top: 1rem;
        }

        .r5-next-link {
          display: block;
          width: 100%;
          text-align: center;
          padding: 0.75rem 1rem;
          border-radius: 9999px;
          font-weight: 700;
          color: #ffffff;
          text-decoration: none;
          background: var(--color-primary, #3a75c4);
          box-shadow: var(--shadow-soft, 0 10px 25px rgba(58, 117, 196, 0.25));
        }

        .r5-next-link:focus-visible {
          outline: 2px solid rgba(58, 117, 196, 0.55);
          outline-offset: 2px;
        }
      `}</style>

      {portalHost &&
        createPortal(
          <a href="/cv/1" className="r5-next-link">
            次へ
          </a>,
          portalHost
        )}
    </>
  );
}
