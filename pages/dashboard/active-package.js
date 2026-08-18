import dynamic from 'next/dynamic';

const ActivePackagePage = dynamic(() => import('../../src/pages/student/ActivePackagePage.jsx').then(m => m.ActivePackagePage), { ssr: false });

export default function Page() {
    return <ActivePackagePage />;
}
