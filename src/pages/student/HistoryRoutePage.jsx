import React from 'react';
import { useExam } from '../../context/ExamContext.jsx';
import { HistoryPage } from './HistoryPage.jsx';
import { DashboardShell } from '../../layouts/DashboardShell.jsx';

export const HistoryRoutePage = () => {
    const { setActiveResult } = useExam();
    return (
        <DashboardShell>
            <HistoryPage onViewResult={setActiveResult} />
        </DashboardShell>
    );
};
