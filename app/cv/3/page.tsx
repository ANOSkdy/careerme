import AiComposer from '../_components/AiComposer';
import PdfActions from './PdfActions';

export default function Page() {
  return (
    <>
      <PdfActions />
      <div id="cv-print-root">
        <AiComposer initialTab="summary" />
      </div>
    </>
  );
}
