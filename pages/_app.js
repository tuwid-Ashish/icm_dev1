// Global CSS must be imported here (Next.js only allows global stylesheet
// imports in the custom App) — moved out of src/App.jsx, which previously
// imported these directly as a plain Vite SPA component.
import '../src/styles/theme.css';
import '../src/styles/components.css';
import dynamic from 'next/dynamic';

// AppProviders reads localStorage/Firebase on mount, so it's loaded
// client-only — nested ssr:false components render null on the server
// regardless of where the ssr:false boundary sits, so this also covers
// pages that dynamically import their own content with ssr:false.
const AppProviders = dynamic(() => import('../src/context/AppProviders.jsx').then(m => m.AppProviders), { ssr: false });

export default function MyApp({ Component, pageProps }) {
    return (
        <AppProviders>
            <Component {...pageProps} />
        </AppProviders>
    );
}
