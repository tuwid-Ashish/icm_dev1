import React from 'react';
import { ThemeProvider } from './ThemeContext.jsx';
import { AuthProvider } from './AuthContext.jsx';
import { LanguageProvider } from './LanguageContext.jsx';
import { ExamProvider } from './ExamContext.jsx';

// Hoisted out of src/App.jsx into pages/_app.js so these providers persist
// across Next.js page navigations (pages/_app.js stays mounted between
// route changes; only the page component swaps) instead of remounting —
// and losing auth/exam state — every time a dedicated dashboard page loads.
export const AppProviders = ({ children }) => (
    <ThemeProvider>
        <AuthProvider>
            <LanguageProvider>
                <ExamProvider>
                    {children}
                </ExamProvider>
            </LanguageProvider>
        </AuthProvider>
    </ThemeProvider>
);
