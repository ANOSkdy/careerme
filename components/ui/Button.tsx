'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'default' | 'secondary' | 'ghost' | 'ai';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
};

function mergeClassName(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(' ');
}

const Spinner = () => (
  <span
    className="ui-button__spinner"
    aria-hidden="true"
    role="presentation"
  >
    <style jsx>{`
      .ui-button__spinner {
        display: inline-block;
        width: 1em;
        height: 1em;
        border-radius: 9999px;
        border: 2px solid rgba(255, 255, 255, 0.6);
        border-top-color: rgba(255, 255, 255, 1);
        animation: ui-button-spin 0.9s linear infinite;
        margin-right: 0.5em;
      }

      @keyframes ui-button-spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
    `}</style>
  </span>
);

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', loading = false, className, children, disabled, ...rest }, ref) => {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        className={mergeClassName('ui-button', `ui-button--${variant}`, isDisabled && 'is-disabled', loading && 'is-loading', className)}
        disabled={isDisabled}
        {...rest}
      >
        {loading ? <Spinner /> : null}
        <span className="ui-button__label">{children}</span>
        <style jsx>{`
          .ui-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.25rem;
            border-radius: 9999px;
            border: none;
            padding: 0.65rem 1.25rem;
            font-size: 0.95rem;
            font-weight: 600;
            transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
            cursor: pointer;
            background: var(--ui-button-bg, #111827);
            color: var(--ui-button-fg, #ffffff);
            min-height: 2.75rem;
          }

          .ui-button:focus-visible {
            outline: 2px solid #6366f1;
            outline-offset: 2px;
          }

          .ui-button.is-disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .ui-button--default {
            --ui-button-bg: linear-gradient(135deg, #6366f1, #8b5cf6);
            box-shadow: 0 8px 16px rgba(99, 102, 241, 0.3);
          }

          .ui-button--default:hover:not(.is-disabled) {
            transform: translateY(-1px);
            box-shadow: 0 12px 24px rgba(99, 102, 241, 0.35);
          }

          .ui-button--secondary {
            --ui-button-bg: #ffffff;
            --ui-button-fg: #111827;
            border: 1px solid rgba(17, 24, 39, 0.12);
          }

          .ui-button--secondary:hover:not(.is-disabled) {
            background: rgba(17, 24, 39, 0.04);
          }

          .ui-button--ghost {
            --ui-button-bg: transparent;
            --ui-button-fg: #111827;
            border: 1px solid transparent;
          }

          .ui-button--ghost:hover:not(.is-disabled) {
            background: rgba(17, 24, 39, 0.05);
          }

          .ui-button--ai {
            --ui-button-bg: linear-gradient(135deg, #14b8a6, #6366f1, #ec4899);
            box-shadow: 0 10px 24px rgba(20, 184, 166, 0.25);
          }

          .ui-button--ai:hover:not(.is-disabled) {
            transform: translateY(-1px);
            box-shadow: 0 14px 28px rgba(99, 102, 241, 0.3);
          }

          .ui-button__label {
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
        `}</style>
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
