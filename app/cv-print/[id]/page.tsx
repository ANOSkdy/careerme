import dynamic from 'next/dynamic';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

interface PrintSnapshotResponse {
  id: string;
  html: string;
  templateVersion?: string | null;
  createdAt?: string;
}

async function fetchSnapshot(id: string): Promise<PrintSnapshotResponse | null> {
  const headersList = headers();
  const forwardedProto = headersList.get('x-forwarded-proto');
  const host = headersList.get('host');
  const origin =
    headersList.get('origin') ??
    (host ? `${forwardedProto ?? 'http'}://${host}` : undefined) ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const response = await fetch(`${origin}/api/prints/${id}`, {
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Failed to load print snapshot');
  }

  return (await response.json()) as PrintSnapshotResponse;
}

function getPrintStyles(): string {
  return `
    body {
      background: #f5f5f5;
      margin: 0;
      padding: 24px;
      display: flex;
      justify-content: center;
    }

    .cv-print-shell {
      width: 100%;
      max-width: 960px;
    }

    @page {
      size: A4;
      margin: 12mm;
    }

    @media print {
      body {
        background: #fff;
        padding: 0;
      }

      body * {
        display: none !important;
      }

      #cv-print-root,
      #cv-print-root * {
        display: revert !important;
      }

      #cv-print-root [data-print-hidden='true'],
      #cv-print-root [data-print-hidden='true'] * {
        display: none !important;
      }

      #cv-print-root {
        position: static !important;
        width: 100%;
        visibility: visible !important;
      }

      #cv-print-root .cv-card,
      #cv-print-root section,
      #cv-print-root h2,
      #cv-print-root h3,
      #cv-print-root h4,
      #cv-print-root h5,
      #cv-print-root h6 {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      #cv-print-root .cv-card {
        page-break-after: avoid;
      }
    }
  `;
}

const PrintClient = dynamic(
  () =>
    import('react').then(({ useEffect }) => {
      const Client = () => {
        useEffect(() => {
          const timer = window.setTimeout(() => {
            try {
              window.print();
            } catch (error) {
              console.error('Failed to open print dialog', error);
            }
          }, 100);

          return () => {
            window.clearTimeout(timer);
          };
        }, []);

        return <style dangerouslySetInnerHTML={{ __html: getPrintStyles() }} />;
      };

      return Client;
    }),
  { ssr: false },
);

export default async function CvPrintPage({
  params,
}: {
  params: { id: string };
}) {
  const snapshot = await fetchSnapshot(params.id);
  if (!snapshot) {
    notFound();
  }

  return (
    <div className="cv-print-shell">
      <div
        id="cv-print-root"
        dangerouslySetInnerHTML={{ __html: snapshot.html }}
        suppressHydrationWarning
      />
      <PrintClient />
    </div>
  );
}
