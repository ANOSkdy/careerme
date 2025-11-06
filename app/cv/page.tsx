import { redirect } from 'next/navigation';

export default function CvIndex() {
  redirect('/cv/1');
}

export const dynamic = 'force-static';
