// Global CSS must be imported here (Next.js only allows global stylesheet
// imports in the custom App) — moved out of src/App.jsx, which previously
// imported these directly as a plain Vite SPA component.
import '../src/styles/theme.css';
import '../src/styles/components.css';

export default function MyApp({ Component, pageProps }) {
    return <Component {...pageProps} />;
}
