import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CV Wizard',
};

export default function CvLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>CV Wizard</h1>
      <nav style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <a href="/cv/1" style={{ textDecoration: 'underline' }}>Step 1: Q&amp;A</a>
        <a href="/cv/2" style={{ textDecoration: 'underline' }}>Step 2: 自己PR</a>
        <a href="/cv/3" style={{ textDecoration: 'underline' }}>Step 3: 要約</a>
      </nav>
      <div>{children}</div>
    </div>
  );
}
