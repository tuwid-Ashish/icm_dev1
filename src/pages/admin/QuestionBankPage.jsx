import React, { useState } from 'react';
import { QuestionBankManager } from '../../components/admin/QuestionBankManager.jsx';

export const QuestionBankPage = () => {
    const [refreshKey, setRefreshKey] = useState(0);

    return (
        <div key={refreshKey}>
            <QuestionBankManager onRefresh={() => setRefreshKey(prev => prev + 1)} />
        </div>
    );
};
