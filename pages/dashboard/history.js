import dynamic from 'next/dynamic';

const HistoryRoutePage = dynamic(() => import('../../src/pages/student/HistoryRoutePage.jsx').then(m => m.HistoryRoutePage), { ssr: false });

export default function Page() {
    return <HistoryRoutePage />;
}
