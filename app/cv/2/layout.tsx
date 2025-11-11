import SelfPRSimplified from '../../../components/cv/SelfPRSimplified';
import type { ReactNode } from 'react';

// Route-scoped layout override for /cv/2.
// Intentionally does NOT render {children} to replace existing UI without editing it.
export default function Layout(_props: { children: ReactNode }) {
  return <SelfPRSimplified />;
}
