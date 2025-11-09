"use client";

import type { ReactNode } from "react";

export default function ResumeStep5Template({ children }: { children: ReactNode }) {
  return (
    <div className="resume5-template">
      <div className="resume5-template__inner">{children}</div>
      <style jsx>{`
        .resume5-template {
          display: flex;
          justify-content: center;
          width: 100%;
          padding: 32px 16px 56px;
          box-sizing: border-box;
        }
        .resume5-template__inner {
          width: 100%;
          max-width: 720px;
        }
        @media (min-width: 768px) {
          .resume5-template {
            padding: 48px 24px 72px;
          }
        }
      `}</style>
      <style jsx global>{`
        .resume5-template [aria-hidden='true'] {
          /* hide decorative required asterisks */
          display: none !important;
        }
        .resume5-template [data-required='true']::after,
        .resume5-template .required::after,
        .resume5-template .is-required::after,
        .resume5-template label::after {
          content: none !important;
        }
      `}</style>
    </div>
  );
}
