'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

function neutralizeGuards(scope: ParentNode) {
  scope.querySelectorAll('[required]').forEach((node) => {
    node.removeAttribute('required')
  })
  scope.querySelectorAll('[aria-required="true"]').forEach((node) => {
    node.setAttribute('aria-required', 'false')
  })

  scope.querySelectorAll<HTMLElement>('span, strong, em, small, sup').forEach((node) => {
    const text = node.textContent?.trim()
    if (text === '必須' || text === '*' || text === '＊') {
      node.style.display = 'none'
    }
  })
}

function enableActions(scope: ParentNode) {
  scope.querySelectorAll<HTMLElement>('button[disabled], [aria-disabled="true"]').forEach((node) => {
    node.removeAttribute('disabled')
    node.setAttribute('aria-disabled', 'false')
    node.classList.remove('is-disabled')
  })
}

function hideNativeNext(scope: ParentNode) {
  scope.querySelectorAll<HTMLElement>('.step-nav__button--primary').forEach((node) => {
    if (node.classList.contains('r5-next-link')) return
    node.style.setProperty('display', 'none', 'important')
  })
}

function ensureHeader(root: HTMLElement, form: HTMLFormElement) {
  let header = form.querySelector('.r5-header') as HTMLElement | null
  if (!header) {
    header = document.createElement('div')
    header.className = 'r5-header'
    form.insertBefore(header, form.firstChild)
  }

  let heading = header.querySelector('.resume-page-title') as HTMLElement | null
  if (!heading) {
    heading = document.createElement('h2')
    heading.className = 'resume-page-title'
    header.appendChild(heading)
  }
  const sourceTitle = root.querySelector('.resume-step__title')
  heading.textContent = sourceTitle?.textContent?.trim() || '希望条件'
  sourceTitle?.remove()

  const sourceDescription = root.querySelector('.resume-step__description')
  const descriptionText = sourceDescription?.textContent?.trim()
  let description = header.querySelector('.r5-description') as HTMLElement | null
  if (descriptionText) {
    if (!description) {
      description = document.createElement('p')
      description.className = 'r5-description'
      header.appendChild(description)
    }
    description.textContent = descriptionText
  } else if (description) {
    description.remove()
  }
  sourceDescription?.remove()

  const loadError = Array.from(root.children).find(
    (child) => child instanceof HTMLElement && child.classList.contains('form-error') && child.getAttribute('role') === 'alert'
  )
  if (loadError instanceof HTMLElement) {
    loadError.classList.add('r5-load-error')
    header.appendChild(loadError)
  }
}

function moveStatus(root: HTMLElement, form: HTMLFormElement) {
  const status = root.querySelector('.resume-step__status') as HTMLElement | null
  if (!status) return

  status.classList.add('r5-status')
  const nav = form.querySelector('.step-nav')
  if (nav) {
    if (status.nextElementSibling !== nav) {
      nav.parentElement?.insertBefore(status, nav)
    }
  } else if (status.parentElement !== form) {
    form.appendChild(status)
  }
}

function ensureNextHost(form: HTMLFormElement) {
  const nav = form.querySelector('.step-nav')
  if (!nav) return null

  const existingHost = nav.querySelector<HTMLElement>('.r5-next-host')
  if (existingHost) return existingHost

  const host = document.createElement('span')
  host.className = 'r5-next-host'

  const nativeNext = Array.from(nav.querySelectorAll<HTMLElement>('.step-nav__button--primary')).find(
    (node) => !node.classList.contains('r5-next-link')
  )

  if (nativeNext) {
    nativeNext.insertAdjacentElement('afterend', host)
  } else {
    nav.appendChild(host)
  }

  return host
}

export default function ResumeStep5Template({ children }: { children: ReactNode }) {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
  const hostRef = useRef<HTMLElement | null>(null)
  const observerRef = useRef<MutationObserver | null>(null)

  useEffect(() => {
    const apply = () => {
      const root = document.querySelector('.resume-step') as HTMLElement | null
      const form = root?.querySelector('form') as HTMLFormElement | null
      if (!root || !form) return

      root.classList.add('r5-root')
      form.classList.add('r5-form')
      form.setAttribute('novalidate', 'true')

      ensureHeader(root, form)
      moveStatus(root, form)
      neutralizeGuards(form)
      enableActions(form)
      hideNativeNext(form)

      const host = ensureNextHost(form)
      if (host && hostRef.current !== host) {
        hostRef.current = host
        setPortalHost(host)
      }
    }

    apply()

    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    const target = document.querySelector('.resume-step') ?? document.body
    observerRef.current = new MutationObserver(() => {
      apply()
    })
    observerRef.current.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
    })

    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
      if (hostRef.current?.parentElement) {
        hostRef.current.remove()
      }
      hostRef.current = null
      setPortalHost(null)
    }
  }, [])

  return (
    <>
      {children}
      <style>{`
        .r5-root {
          width: 100%;
          max-width: 40rem;
          margin: 0 auto;
        }

        .r5-form {
          display: grid;
          gap: 24px;
          padding: 0 0 8px;
        }

        .r5-header {
          display: grid;
          gap: 12px;
        }

        .r5-description {
          color: var(--color-text-muted, #6b7280);
          font-size: 0.875rem;
          line-height: 1.6;
        }

        .r5-load-error {
          color: #dc2626;
          font-size: 0.875rem;
        }

        .r5-status {
          display: flex;
          justify-content: flex-end;
        }

        .r5-root .desired-section {
          display: grid;
          gap: 12px;
          padding: 16px;
          border: 1px solid var(--color-border, #d1d5db);
          border-radius: 12px;
          background: var(--color-bg, #ffffff);
        }

        .r5-root .desired-section__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .r5-root .desired-section__header h2 {
          font-size: 1rem;
          font-weight: 600;
          margin: 0;
          color: var(--color-text-strong, #111827);
        }

        .r5-root .button.button--secondary {
          border-radius: 9999px;
          padding: 6px 16px;
        }

        .r5-root .chip-group {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .r5-root .modal-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .r5-root .modal-option {
          position: relative;
          display: inline-flex;
          align-items: center;
        }

        .r5-root .modal-option input[type="checkbox"],
        .r5-root .modal-option input[type="radio"] {
          position: absolute;
          inset: 0;
          opacity: 0;
          pointer-events: none;
        }

        .r5-root .modal-option span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 18px;
          border-radius: 9999px;
          border: 1px solid var(--color-border, #d1d5db);
          background: #ffffff;
          color: var(--color-text, #1f2937);
          font-weight: 600;
          font-size: 0.95rem;
          transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .r5-root .modal-option input:checked + span {
          background: var(--color-primary, #3a75c4);
          color: #ffffff;
          border-color: var(--color-primary, #3a75c4);
          box-shadow: 0 0 0 1px rgba(58, 117, 196, 0.35);
        }

        .r5-root .modal-option input:focus-visible + span {
          outline: 2px solid rgba(58, 117, 196, 0.55);
          outline-offset: 2px;
        }

        .r5-root .modal-option.is-disabled span {
          opacity: 0.45;
        }

        .r5-root .step-nav {
          margin-top: 8px;
        }

        .r5-next-host {
          display: contents;
        }

        .r5-next-link {
          text-decoration: none;
        }

        .r5-root form label::after,
        .r5-root form [data-required="true"]::after,
        .r5-root form .required::after,
        .r5-root form .is-required::after {
          content: none !important;
        }
      `}</style>

      {portalHost &&
        createPortal(
          <a
            href="/cv/1"
            className="step-nav__button step-nav__button--primary r5-next-link"
            data-r5-next="true"
          >
            次へ
          </a>,
          portalHost
        )}
    </>
  )
}
