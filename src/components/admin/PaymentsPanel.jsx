import React, { useState, useEffect, useMemo } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { Modal } from '../common/Modal.jsx';

// Admin view of every Razorpay payment against what the database recorded.
// The point is the dispute case: money was taken, but the package never reached
// the student. Razorpay is the record of "was it paid"; the database is the
// record of "was it credited", and this screen puts them side by side so an
// unassigned payment can be assigned in one step.

const FILTERS = [
    { id: 'pending', label: 'Not credited' },
    { id: 'credited', label: 'Credited' },
    { id: 'other', label: 'Failed / refunded' },
    { id: 'all', label: 'All' }
];

const fmtDate = (iso) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// A captured, un-refunded payment is the only kind that is owed a package.
const isOwed = (p) => p.status === 'captured' && !p.refunded && !p.credited;

const statusOf = (p) => {
    if (p.status === 'captured' && p.refunded) return { cls: 'badge-warning', text: 'Refunded' };
    if (p.status === 'captured' && p.credited) return { cls: 'badge-success', text: 'Credited' };
    if (p.status === 'captured') return { cls: 'badge-danger', text: 'Not credited' };
    if (p.status === 'failed') return { cls: 'badge-warning', text: 'Failed — no charge' };
    return { cls: 'badge-warning', text: p.status };
};

export const PaymentsPanel = () => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('pending');

    // Assign dialog
    const [assigning, setAssigning] = useState(null);
    const [students, setStudents] = useState(null);
    const [search, setSearch] = useState('');
    const [chosenUid, setChosenUid] = useState('');
    const [busy, setBusy] = useState(false);
    const [dialogError, setDialogError] = useState('');
    const [notice, setNotice] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            setRows(await firestoreEngine.adminListPayments());
        } catch (err) {
            setError(err.message || 'Could not load payments.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const counts = useMemo(() => ({
        owed: rows.filter(isOwed).length,
        owedAmount: rows.filter(isOwed).reduce((s, p) => s + p.amount, 0),
        credited: rows.filter(p => p.status === 'captured' && !p.refunded && p.credited).length
    }), [rows]);

    const visible = rows.filter(p => {
        if (filter === 'pending') return isOwed(p);
        if (filter === 'credited') return p.status === 'captured' && !p.refunded && p.credited;
        if (filter === 'other') return p.status !== 'captured' || p.refunded;
        return true;
    });

    const openAssign = async (row) => {
        setAssigning(row);
        setChosenUid(row.suggested ? row.suggested.uid : '');
        setSearch('');
        setDialogError('');
        if (!students) {
            try { setStudents(await firestoreEngine.getStudents()); }
            catch { setDialogError('Could not load the student list.'); }
        }
    };

    const matches = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = students || [];
        const filtered = !q ? list : list.filter(s =>
            (s.name || '').toLowerCase().includes(q) ||
            (s.email || '').toLowerCase().includes(q) ||
            String(s.mobile || '').includes(q));
        return filtered.slice(0, 40);
    }, [students, search]);

    const confirmAssign = async () => {
        if (!assigning || !chosenUid) return;
        setBusy(true);
        setDialogError('');
        try {
            const res = await firestoreEngine.adminCreditPayment({ paymentId: assigning.paymentId, uid: chosenUid });
            setNotice(res.message || 'Done.');
            setAssigning(null);
            await load();
        } catch (err) {
            setDialogError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const chosen = (students || []).find(s => (s.uid || s.id) === chosenUid) || (assigning && assigning.suggested && assigning.suggested.uid === chosenUid ? assigning.suggested : null);

    return (
        <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h3 className="card-title">Payments</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Every Razorpay payment, checked against what students actually received. If someone paid but
                        has no package, assign it here.
                    </p>
                </div>
                <button className="btn btn-secondary" onClick={load} disabled={loading}>
                    {loading ? 'Loading…' : 'Refresh'}
                </button>
            </div>

            {notice && (
                <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)', padding: '0.65rem 0.9rem', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '1rem' }}>
                    {notice}
                </div>
            )}

            {error && (
                <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '0.65rem 0.9rem', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.88rem', marginBottom: '1rem' }}>
                    {error}
                </div>
            )}

            {!loading && !error && (
                <div style={{
                    background: counts.owed ? 'var(--danger-bg)' : 'var(--success-bg)',
                    border: `1px solid ${counts.owed ? 'var(--danger-border)' : 'var(--success-border)'}`,
                    color: counts.owed ? 'var(--danger)' : 'var(--success)',
                    padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.92rem', marginBottom: '1rem'
                }}>
                    {counts.owed
                        ? `${counts.owed} paid payment${counts.owed === 1 ? '' : 's'} (₹${counts.owedAmount}) ${counts.owed === 1 ? 'has' : 'have'} not reached a student. Assign ${counts.owed === 1 ? 'it' : 'them'} below.`
                        : `All ${counts.credited} paid payments have reached a student.`}
                </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {FILTERS.map(f => (
                    <button key={f.id} className={`btn btn-sm ${filter === f.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f.id)}>
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Paid on</th>
                            <th>Paid by (at checkout)</th>
                            <th>Package</th>
                            <th style={{ textAlign: 'right' }}>Amount</th>
                            <th>Status</th>
                            <th>Payment ID</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading payments from Razorpay…</td></tr>
                        ) : visible.length === 0 ? (
                            <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Nothing here.</td></tr>
                        ) : visible.map(p => {
                            const st = statusOf(p);
                            return (
                                <tr key={p.paymentId}>
                                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{fmtDate(p.paidAt)}</td>
                                    <td style={{ fontSize: '0.85rem' }}>
                                        <div>{p.buyerEmail || '—'}</div>
                                        <small style={{ color: 'var(--text-muted)' }}>{p.buyerPhone || ''}</small>
                                    </td>
                                    <td style={{ fontSize: '0.85rem' }}>
                                        {p.packageName || <span style={{ color: 'var(--text-muted)' }}>{p.packageId || '—'}</span>}
                                        {p.packageTests ? <small style={{ display: 'block', color: 'var(--text-muted)' }}>{p.packageTests} tests</small> : null}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{p.amount}</td>
                                    <td>
                                        <span className={`badge ${st.cls}`}>{st.text}</span>
                                        {p.credited && p.creditedTo && (
                                            <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                                                {p.creditedTo.name || p.creditedTo.email || 'a student'}
                                            </small>
                                        )}
                                    </td>
                                    <td><code style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{p.paymentId}</code></td>
                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                        {isOwed(p) && (
                                            <button className="btn btn-primary btn-sm" onClick={() => openAssign(p)}>
                                                {p.suggested ? 'Credit…' : 'Assign…'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <Modal
                isOpen={!!assigning}
                onClose={() => !busy && setAssigning(null)}
                title="Give this payment's package to a student"
                subtitle="The package, price and number of tests come from the payment itself."
                maxWidth="620px"
                footer={
                    <>
                        <button className="btn btn-secondary" onClick={() => setAssigning(null)} disabled={busy}>Cancel</button>
                        <button className="btn btn-primary" onClick={confirmAssign} disabled={busy || !chosenUid}>
                            {busy ? 'Crediting…' : 'Credit package'}
                        </button>
                    </>
                }
            >
                {assigning && (
                    <div>
                        {dialogError && (
                            <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '1rem' }}>
                                {dialogError}
                            </div>
                        )}

                        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', fontSize: '0.88rem', marginBottom: '1rem' }}>
                            <div><strong>₹{assigning.amount}</strong> paid on {fmtDate(assigning.paidAt)}</div>
                            <div>Package: <strong>{assigning.packageName || assigning.packageId}</strong>{assigning.packageTests ? ` — ${assigning.packageTests} tests` : ''}</div>
                            <div style={{ color: 'var(--text-muted)' }}>Paid by {assigning.buyerEmail || '—'} {assigning.buyerPhone ? `· ${assigning.buyerPhone}` : ''}</div>
                        </div>

                        {assigning.suggested && (
                            <div style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                                Suggested: <strong>{assigning.suggested.name || assigning.suggested.email}</strong>
                                {' '}({assigning.suggested.reason === 'order' ? 'the account that started this payment' : 'the only student with the buyer\'s email'}).
                            </div>
                        )}

                        <label className="form-label">Student</label>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Search by name, email or mobile…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ marginBottom: '0.6rem' }}
                        />
                        <div style={{ maxHeight: '210px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                            {students === null && !dialogError && <div style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>Loading students…</div>}
                            {matches.map(s => {
                                const uid = s.uid || s.id;
                                return (
                                    <label key={uid} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.5rem 0.75rem', cursor: 'pointer', background: uid === chosenUid ? 'var(--bg-subtle)' : 'transparent', borderBottom: '1px solid var(--border-color)' }}>
                                        <input type="radio" name="student" checked={uid === chosenUid} onChange={() => setChosenUid(uid)} />
                                        <span>
                                            <strong>{s.name || '(no name)'}</strong>
                                            <small style={{ display: 'block', color: 'var(--text-muted)' }}>{s.email}{s.mobile ? ` · ${s.mobile}` : ''}</small>
                                        </span>
                                    </label>
                                );
                            })}
                            {students && matches.length === 0 && <div style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>No students match.</div>}
                        </div>

                        {chosen && (
                            <div style={{ marginTop: '0.85rem', fontSize: '0.85rem', fontWeight: 700 }}>
                                This will add {assigning.packageTests || 'the package\'s'} tests to {chosen.name || chosen.email}.
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};
