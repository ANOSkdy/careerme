type PageProps = { params: Promise<{ id: string }> };

function getBaseUrl() {
  // Vercel 本番環境では VERCEL_URL を優先
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // ローカル / 手動指定用
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export default async function CvPrintPage({ params }: PageProps) {
  const { id } = await params;

  const base = getBaseUrl();
  const apiRes = await fetch(`${base}/api/prints/${id}`, { cache: "no-store" });
  const json = await apiRes.json();

  if (!apiRes.ok || !json?.ok) {
    return (
      <main id="cv-print-root" className="p-8">
        <h1>Print snapshot (error)</h1>
        <pre>{JSON.stringify(json, null, 2)}</pre>
      </main>
    );
  }

  const snapshot = json.snapshot;
  const model = snapshot?.payload;

  return (
    <>
      <style>{`
@page { size: A4; margin: 12mm; }
@media print {
  body * { visibility: hidden; }
  #cv-print-root, #cv-print-root * { visibility: visible; }
  #cv-print-root { position: static !important; }
}
      `}</style>

      {/* 自動印刷 */}
      <script
        id="autoprint"
        dangerouslySetInnerHTML={{
          __html: "setTimeout(()=>{try{window.print()}catch(e){}},0);",
        }}
      />

      <main id="cv-print-root" className="p-8">
        <h1>職務経歴書 (snapshot)</h1>
        <section>
          <h2>Snapshot ID</h2>
          <p>{id}</p>
        </section>
        <section>
          <h2>Render Model (debug)</h2>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {JSON.stringify(model, null, 2)}
          </pre>
        </section>
      </main>
    </>
  );
}
