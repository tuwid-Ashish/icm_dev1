import dynamic from 'next/dynamic';

const FreeTestsPage = dynamic(() => import('../../src/pages/student/FreeTestsPage.jsx').then(m => m.FreeTestsPage), { ssr: false });

export default function Page() {
    return <FreeTestsPage />;
}
