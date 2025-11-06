import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CV Wizard',
};

export default function CvLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cv-shell">
      <header className="cv-header">
        <h1>CV Wizard</h1>
        <nav className="cv-nav" aria-label="Steps">
          <a href="/cv/2">Step 2: 自己PR</a>
          <a href="/cv/3">Step 3: 要約</a>
        </nav>
      </header>
      <main className="cv-main">{children}</main>
      <style>{`
        :root{
          --cv-bg:#F9F9F9;
          --cv-card:#FFFFFF;
          --cv-text:#111111;
          --cv-muted:#666666;
          --cv-border:#e5e7eb;
          --cv-primary:#4A90E2;
          --cv-secondary:#50E3C2;
          --cv-accent:#FFD166;
          --cv-radius:16px;
        }
        .cv-shell{min-height:100vh;background:var(--cv-bg);color:var(--cv-text);}
        .cv-header{max-width:960px;margin:0 auto;padding:20px 16px 8px;}
        .cv-header h1{font-size:24px;font-weight:800;margin:0 0 8px;}
        .cv-nav{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:6px}
        .cv-nav a{color:var(--cv-primary);text-decoration:underline}
        .cv-main{max-width:960px;margin:0 auto;padding:16px}
        /* Atoms */
        .cv-field{display:flex;gap:10px;align-items:center}
        .cv-field+.cv-field{margin-top:10px}
        .cv-label{min-width:120px;color:var(--cv-muted)}
        .cv-input,.cv-textarea,.cv-select{
          flex:1;padding:10px;border:1px solid var(--cv-border);
          border-radius:10px;background:#fff
        }
        .cv-textarea{min-height:96px}
        .cv-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
        .cv-btn{
          display:inline-flex;align-items:center;justify-content:center;
          padding:10px 14px;border-radius:12px;border:1px solid var(--cv-border);
          background:#fff;color:var(--cv-text);cursor:pointer;text-decoration:none
        }
        .cv-btn.primary{background:var(--cv-primary);border-color:var(--cv-primary);color:#fff}
        .cv-btn.ghost{background:#fff;color:var(--cv-primary);border-color:var(--cv-primary)}
        .cv-btn:disabled{opacity:.6;cursor:not-allowed}
        .cv-card{
          border:1px solid var(--cv-border);border-radius:var(--cv-radius);
          background:var(--cv-card);padding:14px 16px;
          box-shadow:0 2px 10px rgba(0,0,0,.04)
        }
        .cv-card h3{font-weight:700;margin:0 0 6px}
        .cv-kicker{color:var(--cv-muted);font-size:12px;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.08em}
      `}</style>
    </div>
  );
}
