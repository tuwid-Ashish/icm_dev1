import React, { useState } from 'react';
import { StudentTable } from '../../components/admin/StudentTable.jsx';

export const StudentsPage = () => {
    const [refreshKey, setRefreshKey] = useState(0);

    return (
        <div key={refreshKey}>
            <StudentTable onRefresh={() => setRefreshKey(prev => prev + 1)} />
        </div>
    );
};
