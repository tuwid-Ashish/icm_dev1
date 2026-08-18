import React from 'react';
import { ExamCatalogPage } from './ExamCatalogPage.jsx';
import { DashboardShell } from '../../layouts/DashboardShell.jsx';

export const ExamsRoutePage = () => (
    <DashboardShell>
        <ExamCatalogPage />
    </DashboardShell>
);
