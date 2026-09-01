import React, { useState } from 'react';
import { SUBJECT_CODES, resolveSubjectCode } from '../../constants/subjectCodes.js';

export const SubjectWiseCountWidget = ({ questions = [], onSelectSubject, selectedSubject = 'ALL' }) => {
    const [selectedBatch, setSelectedBatch] = useState('ALL');

    // Filter questions by selected batch if specified
    const filteredQuestions = selectedBatch === 'ALL' 
        ? questions 
        : questions.filter(q => {
            if (Array.isArray(q.batches)) {
                return q.batches.includes('ALL') || q.batches.includes(selectedBatch);
            }
            const b = q.batch || '';
            return b.includes('ALL') || b.includes(selectedBatch);
        });

    // Compute counts per subject code (M1 .. M9 and OTHER)
    const countsByCode = {};
    SUBJECT_CODES.forEach(s => {
        countsByCode[s.code] = 0;
    });
    countsByCode['OTHER'] = 0;

    filteredQuestions.forEach(q => {
        const resolved = resolveSubjectCode(q.subjectCode || q.subject);
        const code = resolved ? resolved.code : 'OTHER';
        if (countsByCode[code] !== undefined) {
            countsByCode[code]++;
        } else {
            countsByCode['OTHER']++;
        }
    });

    const totalCount = filteredQuestions.length;

    // Color accents for each subject badge
    const badgeColors = {
        M1: { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)', text: '#3b82f6' }, // Blue - Maths
        M2: { bg: 'rgba(234, 88, 12, 0.12)', border: 'rgba(234, 88, 12, 0.3)', text: '#ea580c' },  // Orange - Marathi
        M3: { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)', text: '#a855f7' }, // Purple - Reasoning
        M4: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' }, // Green - GK 1
        M5: { bg: 'rgba(20, 184, 166, 0.12)', border: 'rgba(20, 184, 166, 0.3)', text: '#14b8a6' }, // Teal - GK 2
        M6: { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', text: '#f59e0b' }, // Amber - GS 1
        M7: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444' },   // Red - GS 2
        M8: { bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.3)', text: '#ec4899' }, // Pink - Hindi
        M9: { bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.3)', text: '#6366f1' }, // Indigo - English
        OTHER: { bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.3)', text: '#64748b' }
    };

    return (
        <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
        }}>
            {/* Header with Title and Batch Filter */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '1rem',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '0.75rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>📊</span>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Subject-Wise Question Breakdown (M1 – M9 Matrix)
                        </h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Total Available in Pool: <strong>{totalCount} Questions</strong>
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        Batch Filter:
                    </label>
                    <select 
                        className="form-control"
                        style={{ fontSize: '0.82rem', padding: '0.3rem 0.6rem', width: 'auto', minWidth: '150px' }}
                        value={selectedBatch}
                        onChange={(e) => setSelectedBatch(e.target.value)}
                    >
                        <option value="ALL">All Exam Batches</option>
                        <option value="Police Bharti">Police Bharti</option>
                        <option value="Vanrakshak">Vanrakshak</option>
                        <option value="SSC GD">SSC GD</option>
                    </select>
                </div>
            </div>

            {/* Grid of Subject Cards (M1 to M9) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '0.75rem'
            }}>
                {/* "ALL" Chip Card */}
                <div 
                    onClick={() => onSelectSubject && onSelectSubject('ALL')}
                    style={{
                        background: selectedSubject === 'ALL' ? 'var(--primary)' : 'var(--bg-subtle)',
                        color: selectedSubject === 'ALL' ? '#ffffff' : 'var(--text-primary)',
                        border: selectedSubject === 'ALL' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.75rem 0.6rem',
                        textAlign: 'center',
                        cursor: onSelectSubject ? 'pointer' : 'default',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                >
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        ALL SUBJECTS
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.2rem' }}>
                        {totalCount}
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>
                        100% of Pool
                    </div>
                </div>

                {/* M1 through M9 Cards */}
                {SUBJECT_CODES.map((s) => {
                    const count = countsByCode[s.code] || 0;
                    const percent = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                    const colors = badgeColors[s.code] || badgeColors.OTHER;
                    const isSelected = selectedSubject === s.code;

                    return (
                        <div 
                            key={s.code}
                            onClick={() => onSelectSubject && onSelectSubject(isSelected ? 'ALL' : s.code)}
                            title={`Click to filter by ${s.code} - ${s.name}`}
                            style={{
                                background: isSelected ? colors.bg : 'var(--bg-subtle)',
                                border: isSelected ? `2px solid ${colors.text}` : `1px solid ${colors.border}`,
                                borderRadius: 'var(--radius-md)',
                                padding: '0.75rem 0.6rem',
                                textAlign: 'center',
                                cursor: onSelectSubject ? 'pointer' : 'default',
                                transition: 'all 0.15s ease',
                                position: 'relative',
                                boxShadow: isSelected ? `0 2px 8px ${colors.border}` : 'none'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                                <span style={{
                                    background: colors.text,
                                    color: '#ffffff',
                                    fontWeight: 800,
                                    fontSize: '0.72rem',
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: 'var(--radius-sm)'
                                }}>
                                    {s.code}
                                </span>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {s.name}
                                </span>
                            </div>

                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: count > 0 ? colors.text : 'var(--text-muted)' }}>
                                {count}
                            </div>

                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {percent}% of pool
                            </div>

                            {/* Mini progress bar indicator */}
                            <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', borderRadius: '2px', marginTop: '0.4rem', overflow: 'hidden' }}>
                                <div style={{ width: `${percent}%`, height: '100%', background: colors.text }}></div>
                            </div>
                        </div>
                    );
                })}

                {/* Optional "OTHER" card if non-standard codes exist */}
                {countsByCode['OTHER'] > 0 && (
                    <div 
                        onClick={() => onSelectSubject && onSelectSubject(selectedSubject === 'OTHER' ? 'ALL' : 'OTHER')}
                        style={{
                            background: selectedSubject === 'OTHER' ? badgeColors.OTHER.bg : 'var(--bg-subtle)',
                            border: selectedSubject === 'OTHER' ? `2px solid ${badgeColors.OTHER.text}` : `1px solid ${badgeColors.OTHER.border}`,
                            borderRadius: 'var(--radius-md)',
                            padding: '0.75rem 0.6rem',
                            textAlign: 'center',
                            cursor: onSelectSubject ? 'pointer' : 'default'
                        }}
                    >
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: badgeColors.OTHER.text }}>OTHER</span>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: badgeColors.OTHER.text }}>
                            {countsByCode['OTHER']}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Custom Subjects</div>
                    </div>
                )}
            </div>
        </div>
    );
};
