import { redirect } from 'next/navigation';

export default function CvIndex() {
  redirect('/cv/2');
}

export const dynamic = 'force-static';
