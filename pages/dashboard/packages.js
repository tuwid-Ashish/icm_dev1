import dynamic from 'next/dynamic';

const PackagesPage = dynamic(() => import('../../src/pages/student/PackagesPage.jsx').then(m => m.PackagesPage), { ssr: false });

export default function Page() {
    return <PackagesPage />;
}
