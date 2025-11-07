import Step3Client from './Client';
import PdfActions from './PdfActions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  return (
    <>
      <PdfActions />
      <div id="cv-print-root">
        <Step3Client />
      </div>
    </>
  );
}
