import dynamic from 'next/dynamic';

const DashboardHubPage = dynamic(() => import('../../src/pages/student/DashboardHubPage.jsx').then(m => m.DashboardHubPage), { ssr: false });

export default function Page() {
    return <DashboardHubPage />;
}
