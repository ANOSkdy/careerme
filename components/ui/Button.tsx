'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

function classNames(...values: Array<string | undefined | null | false>): string {
  return values.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'ai';

type ButtonProps = {
  variant?: ButtonVariant;
  isLoading?: boolean;
  loadingText?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const variantClassName: Record<ButtonVariant, string> = {
  primary: 'ui-button--primary',
  secondary: 'ui-button--secondary',
  ghost: 'ui-button--ghost',
  outline: 'ui-button--outline',
  ai: 'ui-button--ai',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, variant = 'primary', disabled, isLoading, loadingText, ...props }, ref) => {
    const content = isLoading ? loadingText ?? children : children;
    return (
      <button
        ref={ref}
        className={classNames('ui-button', variantClassName[variant], className, isLoading && 'is-loading')}
        disabled={disabled || isLoading}
        {...props}
      >
        <span className="ui-button__content" aria-live="polite" aria-busy={isLoading || undefined}>
          {content}
        </span>
        <style jsx>{`
          .ui-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            font-weight: 600;
            line-height: 1.2;
            transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
            width: auto;
            min-height: 2.75rem;
            padding-inline: 1.5rem;
          }

          .ui-button--secondary {
            background-color: #ffffff;
            color: var(--color-text);
            border: 1px solid var(--color-border);
          }

          .ui-button--ghost {
            background-color: transparent;
            color: var(--color-text);
            border: 1px solid transparent;
          }

          .ui-button--outline {
            background-color: transparent;
            color: var(--color-text);
            border: 1px solid var(--color-border);
          }

          .ui-button--ai {
            background-image: var(--gradient-ai);
            background-color: transparent;
            color: #ffffff;
            box-shadow: var(--shadow-soft);
          }

          .ui-button--ai:disabled {
            box-shadow: none;
          }

          .ui-button.is-loading {
            pointer-events: none;
          }

          .ui-button__content {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
          }
        `}</style>
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
