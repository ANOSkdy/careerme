import type { ReactNode } from "react";
import TemplateClient from "./TemplateClient";

export default function Template({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <TemplateClient />
    </>
  );
}
