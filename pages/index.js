import dynamic from 'next/dynamic';

// The whole app is one client-rendered React tree (src/App.jsx) doing its
// own internal state-based navigation — no SSR needed, and src/App.jsx +
// its children read window/localStorage directly without SSR guards, so
// this is loaded client-only rather than auditing every call site.
const App = dynamic(() => import('../src/App.jsx'), { ssr: false });

export default function IndexPage() {
    return <App />;
}
