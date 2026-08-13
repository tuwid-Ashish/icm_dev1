import dynamic from 'next/dynamic';

// /admin and any /admin/* path — src/App.jsx already inspects
// window.location.pathname on mount to decide whether to show the admin
// login or dashboard, so this route just needs to render the same app
// shell as the root route.
const App = dynamic(() => import('../../src/App.jsx'), { ssr: false });

export default function AdminCatchAllPage() {
    return <App />;
}
