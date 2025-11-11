"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

type StepNavProps = {
  step: 1 | 2 | 3 | 4 | 5;
  totalSteps?: number;
  nextDisabled?: boolean;
  nextLabel?: string;
  prevHref?: string | null;
  nextHref?: string | null;
  nextType?: "link" | "submit";
  onNextClick?: (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
};

export default function StepNav({
  step,
  totalSteps = 5,
  nextDisabled = false,
  nextLabel = "次へ",
  prevHref,
  nextHref,
  nextType = "link",
  onNextClick,
}: StepNavProps) {
  const router = useRouter();
  const computedPrevHref = prevHref ?? (step === 1 ? null : `/resume/${step - 1}`);
  const computedNextHref =
    nextType === "submit"
      ? nextHref ?? null
      : nextHref ?? (step >= totalSteps ? null : `/resume/${step + 1}`);

  const prevDisabled = !computedPrevHref;
  const nextLinkDisabled =
    nextType === "link" ? !computedNextHref || nextDisabled : nextDisabled;

  const handleDisabledClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
  };

  const handleNextLinkClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (nextLinkDisabled) {
      handleDisabledClick(event);
      return;
    }

    if (!onNextClick) {
      return;
    }

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    const nextHref = computedNextHref;

    if (!nextHref) {
      event.preventDefault();
      return;
    }

    let shouldNavigate = true;
    const proxyEvent = Object.create(event, {
      preventDefault: {
        value: () => {
          shouldNavigate = false;
          event.preventDefault();
        },
      },
    }) as MouseEvent<HTMLAnchorElement | HTMLButtonElement>;

    event.preventDefault();

    try {
      await onNextClick(proxyEvent);
    } catch (error) {
      shouldNavigate = false;
      throw error;
    } finally {
      if (shouldNavigate) {
        router.push(nextHref);
      }
    }
  };

  return (
    <nav className="step-nav" aria-label="ステップナビゲーション">
      <Link
        href={computedPrevHref ?? "#"}
        aria-disabled={prevDisabled}
        tabIndex={prevDisabled ? -1 : undefined}
        onClick={prevDisabled ? handleDisabledClick : undefined}
        className={`step-nav__button step-nav__button--secondary${
          prevDisabled ? " is-disabled" : ""
        }`}
      >
        戻る
      </Link>
      <div className="step-nav__status">Step {step} / {totalSteps}</div>
      {nextType === "link" ? (
        <Link
          href={computedNextHref ?? "#"}
          aria-disabled={nextLinkDisabled}
          tabIndex={nextLinkDisabled ? -1 : undefined}
          onClick={
            nextLinkDisabled
              ? handleDisabledClick
              : onNextClick
                ? handleNextLinkClick
                : undefined
          }
          className={`step-nav__button step-nav__button--primary${
            nextLinkDisabled ? " is-disabled" : ""
          }`}
        >
          {nextLabel}
        </Link>
      ) : (
        <button
          type="submit"
          disabled={nextDisabled}
          onClick={onNextClick}
          className={`step-nav__button step-nav__button--primary${
            nextDisabled ? " is-disabled" : ""
          }`}
        >
          {nextLabel}
        </button>
      )}
    </nav>
  );
}
