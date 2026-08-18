import dynamic from 'next/dynamic';

const ExamsRoutePage = dynamic(() => import('../../src/pages/student/ExamsRoutePage.jsx').then(m => m.ExamsRoutePage), { ssr: false });

export default function Page() {
    return <ExamsRoutePage />;
}
