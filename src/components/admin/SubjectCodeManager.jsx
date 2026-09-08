import React, { useState, useEffect } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { Modal } from '../common/Modal.jsx';

const COLOR_PRESETS = [
    { label: 'Blue', value: '#3b82f6' },
    { label: 'Orange', value: '#ea580c' },
    { label: 'Purple', value: '#a855f7' },
    { label: 'Green', value: '#10b981' },
    { label: 'Teal', value: '#14b8a6' },
    { label: 'Amber', value: '#f59e0b' },
    { label: 'Red', value: '#ef4444' },
    { label: 'Pink', value: '#ec4899' },
    { label: 'Indigo', value: '#6366f1' },
    { label: 'Slate', value: '#64748b' }
];

export const SubjectCodeManager = ({ onRefresh }) => {
    const [subjects, setSubjects] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state for Add/Edit
    const [modalOpen, setModalOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState(null);
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [nameMr, setNameMr] = useState('');
    const [aliases, setAliases] = useState('');
    const [color, setColor] = useState('#3b82f6');
    const [order, setOrder] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Delete confirmation state
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletingSubject, setDeletingSubject] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [subList, qList] = await Promise.all([
                firestoreEngine.getSubjectCodes(),
                firestoreEngine.getQuestions('ALL')
            ]);
            setSubjects(subList || []);
            setQuestions(qList || []);
        } catch (err) {
            console.error('[SubjectCodeManager] Error loading subjects:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Compute question count per subject code
    const getQuestionCountForCode = (subjectCode) => {
        const c = (subjectCode || '').toUpperCase();
        return questions.filter(q => {
            const qCode = (q.subjectCode || '').toUpperCase();
            return qCode === c || (q.subject && q.subject.toLowerCase() === subjectCode.toLowerCase());
        }).length;
    };

    const handleOpenEditModal = (subject = null) => {
        setErrorMessage('');
        setEditingSubject(subject);
        if (subject) {
            setCode(subject.code || '');
            setName(subject.name || '');
            setNameMr(subject.name_mr || subject.name || '');
            setAliases(typeof subject.aliases === 'string' ? subject.aliases : (Array.isArray(subject.aliases) ? subject.aliases.join(', ') : ''));
            setColor(subject.color || '#3b82f6');
            setOrder(subject.order || subjects.length + 1);
        } else {
            // Suggest next code (e.g. M10 if M9 is highest M-code)
            const mCodes = subjects
                .map(s => parseInt((s.code || '').replace(/^M/i, ''), 10))
                .filter(n => !isNaN(n));
            const nextNum = mCodes.length > 0 ? Math.max(...mCodes) + 1 : subjects.length + 1;
            
            setCode(`M${nextNum}`);
            setName('');
            setNameMr('');
            setAliases('');
            setColor(COLOR_PRESETS[subjects.length % COLOR_PRESETS.length].value);
            setOrder(subjects.length + 1);
        }
        setModalOpen(true);
    };

    const handleSaveSubject = async (e) => {
        e.preventDefault();
        setErrorMessage('');
        const cleanCode = code.trim().toUpperCase();

        if (!cleanCode) {
            setErrorMessage('Subject Code is required (e.g. M10, M11).');
            return;
        }

        if (!name.trim()) {
            setErrorMessage('Subject Name (English) is required.');
            return;
        }

        // Check code uniqueness for new entries
        if (!editingSubject && subjects.some(s => s.code.toUpperCase() === cleanCode)) {
            setErrorMessage(`Subject Code "${cleanCode}" already exists. Please choose a unique code.`);
            return;
        }

        setIsSaving(true);
        try {
            await firestoreEngine.saveSubjectCode({
                code: cleanCode,
                name: name.trim(),
                name_mr: nameMr.trim() || name.trim(),
                aliases: aliases.trim(),
                color,
                order: parseInt(order, 10) || 99
            });

            setModalOpen(false);
            await loadData();
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error('[SubjectCodeManager] Error saving subject:', err);
            setErrorMessage(err.message || 'Failed to save subject code.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenDeleteModal = (subject) => {
        setDeletingSubject(subject);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!deletingSubject) return;
        setIsDeleting(true);
        try {
            await firestoreEngine.deleteSubjectCode(deletingSubject.code);
            setDeleteModalOpen(false);
            setDeletingSubject(null);
            await loadData();
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error('[SubjectCodeManager] Error deleting subject code:', err);
            alert('Failed to delete subject code: ' + (err.message || 'Unknown error'));
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredSubjects = subjects.filter(s => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
            (s.code && s.code.toLowerCase().includes(query)) ||
            (s.name && s.name.toLowerCase().includes(query)) ||
            (s.name_mr && s.name_mr.toLowerCase().includes(query)) ||
            (s.aliases && s.aliases.toLowerCase().includes(query))
        );
    });

    return (
        <div className="card">
            {/* Header with Title & Action */}
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h3 className="card-title">Subject Codes & Subject Master</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Manage canonical subject codes (M1, M2, ...), Marathi/English names, and search aliases for question categorization.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={() => handleOpenEditModal(null)}>
                        + Add New Subject Code
                    </button>
                </div>
            </div>

            {/* Filter / Search Bar */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input 
                    type="text" 
                    className="form-control" 
                    style={{ flex: 1, minWidth: '240px' }}
                    placeholder="Search subject code, name (English / Marathi) or alias..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Total: {subjects.length} Subjects Defined
                </span>
            </div>

            {/* Data Table */}
            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th style={{ width: '80px' }}>Code</th>
                            <th>Subject Name (English)</th>
                            <th>Subject Name (मराठी)</th>
                            <th>Aliases & Keywords (CSV & Search)</th>
                            <th style={{ textAlign: 'center', width: '130px' }}>Questions Count</th>
                            <th style={{ width: '140px', textAlign: 'right' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading subject codes from Cloud Firestore...</td></tr>
                        ) : filteredSubjects.length === 0 ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No subject codes match your search.</td></tr>
                        ) : (
                            filteredSubjects.map(s => {
                                const qCount = getQuestionCountForCode(s.code);
                                return (
                                    <tr key={s.code}>
                                        <td>
                                            <span style={{
                                                background: s.color || '#3b82f6',
                                                color: '#ffffff',
                                                fontWeight: 800,
                                                fontSize: '0.8rem',
                                                padding: '0.25rem 0.6rem',
                                                borderRadius: 'var(--radius-sm)',
                                                display: 'inline-block',
                                                letterSpacing: '0.5px'
                                            }}>
                                                {s.code}
                                            </span>
                                        </td>
                                        <td>
                                            <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{s.name}</strong>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{s.name_mr || s.name}</span>
                                        </td>
                                        <td style={{ maxWidth: '280px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {s.aliases || '—'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`badge ${qCount > 0 ? 'badge-primary' : 'badge-secondary'}`} style={{ fontSize: '0.82rem', padding: '0.25rem 0.65rem' }}>
                                                {qCount} Qs
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            <button 
                                                className="btn btn-secondary btn-sm" 
                                                style={{ marginRight: '0.4rem', padding: '0.25rem 0.55rem', fontSize: '0.78rem' }}
                                                onClick={() => handleOpenEditModal(s)}
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                className="btn btn-danger btn-sm" 
                                                style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem' }}
                                                onClick={() => handleOpenDeleteModal(s)}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add / Edit Subject Modal */}
            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editingSubject ? `Edit Subject Code: ${editingSubject.code}` : '+ Add New Subject Code'}
                subtitle="Configure subject code, bilingual display labels, and search aliases."
                maxWidth="600px"
                footer={
                    <>
                        <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={isSaving}>
                            Cancel
                        </button>
                        <button type="button" className="btn btn-primary" onClick={handleSaveSubject} disabled={isSaving}>
                            {isSaving ? 'Saving...' : (editingSubject ? 'Update Subject Code' : 'Create Subject Code')}
                        </button>
                    </>
                }
            >
                <form onSubmit={handleSaveSubject}>
                    {errorMessage && (
                        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontWeight: 700, marginBottom: '1rem' }}>
                            {errorMessage}
                        </div>
                    )}

                    <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">
                                Subject Code <span style={{ color: 'var(--danger)' }}>*</span>
                            </label>
                            <input 
                                type="text" 
                                className="form-control" 
                                placeholder="e.g. M10, M11, LAW1" 
                                value={code} 
                                onChange={e => setCode(e.target.value.toUpperCase())}
                                disabled={!!editingSubject}
                                style={{ fontWeight: 700, textTransform: 'uppercase' }}
                                required
                            />
                            <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                Unique identifier (e.g. M1 to M9, M10, M11).
                            </small>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Display Order / Sequence</label>
                            <input 
                                type="number" 
                                min="1"
                                className="form-control" 
                                value={order} 
                                onChange={e => setOrder(e.target.value)} 
                            />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label className="form-label">
                            Subject Name (English) <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <input 
                            type="text" 
                            className="form-control" 
                            placeholder="e.g. Maharashtra Police Acts & Legal Knowledge" 
                            value={name} 
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label className="form-label">Subject Name (मराठी)</label>
                        <input 
                            type="text" 
                            className="form-control" 
                            placeholder="e.g. पोलीस कायदे आणि कायदेशीर ज्ञान" 
                            value={nameMr} 
                            onChange={e => setNameMr(e.target.value)}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label className="form-label">Aliases & Search Keywords (Comma-separated)</label>
                        <textarea 
                            className="form-control" 
                            style={{ minHeight: '65px', fontSize: '0.82rem' }}
                            placeholder="e.g. law, police act, कायदे, पोलीस प्रक्रिया, legal studies" 
                            value={aliases} 
                            onChange={e => setAliases(e.target.value)}
                        />
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            Used by CSV Bulk Upload and Smart Search to auto-match questions to this subject code.
                        </small>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Badge Color Accent</label>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            {COLOR_PRESETS.map(p => (
                                <button
                                    key={p.value}
                                    type="button"
                                    onClick={() => setColor(p.value)}
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        background: p.value,
                                        border: color === p.value ? '3px solid #0f172a' : '2px solid transparent',
                                        cursor: 'pointer',
                                        boxShadow: color === p.value ? '0 0 0 2px #fff inset' : 'none',
                                        transition: 'transform 0.15s ease'
                                    }}
                                    title={p.label}
                                />
                            ))}
                            <input 
                                type="color" 
                                value={color} 
                                onChange={e => setColor(e.target.value)}
                                style={{ width: '32px', height: '32px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                title="Custom Color"
                            />
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="Confirm Subject Code Deletion"
                subtitle="Please review before deleting this subject code from the system."
                maxWidth="480px"
                footer={
                    <>
                        <button type="button" className="btn btn-secondary" onClick={() => setDeleteModalOpen(false)} disabled={isDeleting}>
                            Cancel
                        </button>
                        <button type="button" className="btn btn-danger" onClick={handleConfirmDelete} disabled={isDeleting}>
                            {isDeleting ? 'Deleting...' : 'Yes, Delete Subject Code'}
                        </button>
                    </>
                }
            >
                {deletingSubject && (
                    <div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                            Are you sure you want to delete subject code <strong>{deletingSubject.code} ({deletingSubject.name})</strong>?
                        </p>
                        {getQuestionCountForCode(deletingSubject.code) > 0 ? (
                            <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', fontWeight: 700 }}>
                                ⚠️ Caution: There are currently <strong>{getQuestionCountForCode(deletingSubject.code)} questions</strong> linked to this subject code in the Question Bank. Deleting this code will cause those questions to be classified under OTHER.
                            </div>
                        ) : (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                There are currently 0 questions linked to this subject code. It can be safely removed.
                            </p>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};
