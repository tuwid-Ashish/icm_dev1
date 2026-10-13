import React, { useEffect, useState, useCallback } from 'react';
import { firestoreEngine } from '../../services/firestoreEngine.js';
import { QUOTA_EVENT } from '../../services/firebase.js';
import {
    FREE_LIMITS,
    formatNumber,
    formatResetTimeIST,
    usageStatus,
    approxExtraCostRupees
} from '../../utils/usageLimits.js';

// Shows the client, in plain words, how much of Firebase's free daily allowance
// the portal is using — because every test paper, report and admin screen is
// paid for in "reads", and the free allowance is small.

const STATUS_COLOR = { ok: 'var(--success)', warn: 'var(--warning)', over: 'var(--danger)' };
const rupees = (n) => (n < 1 ? 'less than ₹1' : `about ₹${Math.round(n)}`);

const shortDate = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};

function Meter({ label, used, limit }) {
    const status = usageStatus(used, limit);
    const pct = Math.min(100, (used / limit) * 100);
    return (
        <div style={{ marginBottom: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.3rem' }}>
                <strong style={{ fontSize: '0.92rem' }}>{label}</strong>
                <span style={{ fontSize: '0.9rem' }}>
                    <strong style={{ color: STATUS_COLOR[status] }}>{formatNumber(used)}</strong>
                    <span style={{ color: 'var(--text-muted)' }}> of {formatNumber(limit)} free today</span>
                </span>
            </div>
            <div style={{ height: '12px', background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: STATUS_COLOR[status] }} />
            </div>
            {status === 'over' && (
                <div style={{ marginTop: '0.3rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--danger)' }}>
                    Over the free limit by {formatNumber(used - limit)}
                </div>
            )}
        </div>
    );
}

/** The usage card for the Overview tab. */
export const UsageMeter = ({ questionCount = 0, indexed = false }) => {
    const [usage, setUsage] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        setUsage(await firestoreEngine.adminGetUsage());
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        window.addEventListener(QUOTA_EVENT, load);
        return () => window.removeEventListener(QUOTA_EVENT, load);
    }, [load]);

    const resetAt = formatResetTimeIST();
    const ok = usage && usage.available;
    const reads = ok ? usage.today.reads : 0;
    const writes = ok ? usage.today.writes : 0;
    const readStatus = ok ? usageStatus(reads, FREE_LIMITS.reads) : 'ok';
    const writeStatus = ok ? usageStatus(writes, FREE_LIMITS.writes) : 'ok';
    const worst = readStatus === 'over' || writeStatus === 'over' ? 'over' : (readStatus === 'warn' || writeStatus === 'warn' ? 'warn' : 'ok');

    const extraCost = ok
        ? approxExtraCostRupees(reads - FREE_LIMITS.reads, 'reads') + approxExtraCostRupees(writes - FREE_LIMITS.writes, 'writes')
        : 0;

    const days = ok ? usage.days.slice(-7) : [];
    const scaleMax = Math.max(FREE_LIMITS.reads, ...days.map(d => d.reads)) * 1.05;
    // With the question index built, a paper reads only the questions it contains
    // (about 120 for a 100-question paper); without it, the whole bank is read.
    const readsPerPaper = indexed ? 120 : questionCount;
    const papersPerFreeDay = readsPerPaper > 0 ? Math.floor(FREE_LIMITS.reads / readsPerPaper) : null;
    const exampleReads = readsPerPaper * 100;

    return (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h3 className="card-title">Firebase usage today</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Everything the portal does is paid for in database &quot;reads&quot; and &quot;writes&quot;. Firebase gives a free amount every day
                        and it starts again at about {resetAt} IST.
                    </p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button>
            </div>

            {loading && !usage && <p style={{ color: 'var(--text-muted)' }}>Loading usage...</p>}

            {usage && !usage.available && (
                <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', fontSize: '0.88rem', marginBottom: '1rem' }}>
                    <strong>Usage numbers are not switched on yet.</strong> {usage.message}
                    <div style={{ color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                        The free allowance is {formatNumber(FREE_LIMITS.reads)} reads and {formatNumber(FREE_LIMITS.writes)} writes every day.
                    </div>
                </div>
            )}

            {ok && (
                <>
                    <div style={{
                        background: worst === 'over' ? 'var(--danger-bg)' : worst === 'warn' ? 'var(--warning-bg)' : 'var(--success-bg)',
                        border: `1px solid ${worst === 'over' ? 'var(--danger-border)' : worst === 'warn' ? 'var(--warning-border)' : 'var(--success-border)'}`,
                        color: STATUS_COLOR[worst],
                        borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem'
                    }}>
                        {worst === 'ok' && 'You are inside the free limit today.'}
                        {worst === 'warn' && `You have used more than half of today's free allowance. If it runs out, the portal stops working until about ${resetAt} IST.`}
                        {worst === 'over' && (
                            <>
                                You are over Firebase&apos;s free limit today.
                                <div style={{ fontWeight: 400, marginTop: '0.3rem', color: 'var(--text-primary)' }}>
                                    On the free plan the portal stops working for everyone until about {resetAt} IST. On the pay-as-you-go plan
                                    nothing stops, and the extra use costs {rupees(extraCost)} for today.
                                </div>
                            </>
                        )}
                    </div>

                    <Meter label="Reads (opening data: tests, questions, reports)" used={reads} limit={FREE_LIMITS.reads} />
                    <Meter label="Writes (saving data: results, questions, students)" used={writes} limit={FREE_LIMITS.writes} />

                    {days.length > 0 && (
                        <div style={{ marginTop: '1.25rem' }}>
                            <strong style={{ fontSize: '0.9rem' }}>Reads, last {days.length} days</strong>
                            <div style={{ marginTop: '0.5rem' }}>
                                {days.map(d => {
                                    const st = usageStatus(d.reads, FREE_LIMITS.reads);
                                    return (
                                        <div key={d.date} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 84px', gap: '0.6rem', alignItems: 'center', marginBottom: '0.3rem', fontSize: '0.8rem' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>{shortDate(d.date)}</span>
                                            <div style={{ position: 'relative', height: '10px', background: 'var(--bg-subtle)', borderRadius: '999px' }}>
                                                <div style={{ width: `${(d.reads / scaleMax) * 100}%`, height: '100%', background: STATUS_COLOR[st], borderRadius: '999px' }} />
                                                <div title="Free limit" style={{ position: 'absolute', left: `${(FREE_LIMITS.reads / scaleMax) * 100}%`, top: '-3px', width: '2px', height: '16px', background: 'var(--text-secondary)' }} />
                                            </div>
                                            <span style={{ textAlign: 'right', fontWeight: 700, color: STATUS_COLOR[st] }}>{formatNumber(d.reads)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>The vertical line is the free limit ({formatNumber(FREE_LIMITS.reads)} reads a day).</div>
                        </div>
                    )}
                </>
            )}

            <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.9rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>What uses reads</strong>
                <ul style={{ margin: '0.4rem 0 0 1.1rem', padding: 0, lineHeight: 1.6 }}>
                    {indexed ? (
                        <>
                            <li>A student starting a test paper: about 120 reads. Only the questions in the paper are loaded, however big the question bank is.</li>
                            <li>Opening the Overview, Question Bank, Subject Codes or Exam Paper screens: a few dozen reads each time.</li>
                        </>
                    ) : (
                        <>
                            <li>A student starting a test paper: about {questionCount > 0 ? formatNumber(questionCount) : 'as many as there are questions'} reads, because the whole question bank is loaded.</li>
                            <li>Opening the Overview, Question Bank, Subject Codes or Exam Paper screens: about the same each time.</li>
                            <li><strong>The question index is not built yet.</strong> Build it in the Question Bank tab to cut a paper to about 120 reads.</li>
                        </>
                    )}
                    <li>Opening Reports: one read for every test ever taken.</li>
                    <li>A student seeing their rank after a test: about 15 reads.</li>
                </ul>
                {papersPerFreeDay !== null && (
                    <p style={{ marginTop: '0.6rem' }}>
                        So the free allowance covers only about <strong>{formatNumber(papersPerFreeDay)} test papers a day</strong> for all students together.
                        For example, 100 papers a day would use about {formatNumber(exampleReads)} reads and cost {rupees(approxExtraCostRupees(exampleReads - FREE_LIMITS.reads, 'reads'))} a day on the pay-as-you-go plan.
                    </p>
                )}
                <p style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Costs are rough estimates from Firebase&apos;s price list and can change.
                </p>
            </div>
        </div>
    );
};

/**
 * A red banner that appears on every admin screen the moment Firebase refuses
 * a request because the daily allowance is used up — so an admin sees why the
 * lists are empty instead of thinking the data has gone.
 */
export const UsageBanner = () => {
    const [exceeded, setExceeded] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [usage, setUsage] = useState(null);

    useEffect(() => {
        const onExceeded = async () => {
            setExceeded(true);
            setDismissed(false);
            setUsage(await firestoreEngine.adminGetUsage());
        };
        window.addEventListener(QUOTA_EVENT, onExceeded);
        return () => window.removeEventListener(QUOTA_EVENT, onExceeded);
    }, []);

    if (!exceeded || dismissed) return null;

    const resetAt = formatResetTimeIST();
    const known = usage && usage.available;
    const over = known ? usage.today.reads - FREE_LIMITS.reads : 0;

    return (
        <div role="alert" className="no-print" style={{ background: 'var(--danger-bg)', border: '2px solid var(--danger-border)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                <strong style={{ color: 'var(--danger)', fontSize: '1.02rem' }}>
                    Firebase&apos;s free daily limit has been used up
                </strong>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDismissed(true)}>Close</button>
            </div>
            <p style={{ margin: '0.5rem 0', fontSize: '0.92rem' }}>
                {known && over > 0
                    ? <>Today the portal has used <strong>{formatNumber(usage.today.reads)} reads</strong>. The free limit is <strong>{formatNumber(FREE_LIMITS.reads)}</strong>, so it is over by <strong>{formatNumber(over)}</strong>.</>
                    : <>The free limit is {formatNumber(FREE_LIMITS.reads)} reads and {formatNumber(FREE_LIMITS.writes)} writes every day, and it has been reached.</>}
                {' '}That is why lists look empty and saving or loading fails. Your data is safe.
            </p>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                It starts again at about <strong>{resetAt} IST</strong>. To stop this happening, switch the Firebase project to the
                pay-as-you-go plan: the same free amount is still included every day, and you pay only for the extra.
            </p>
        </div>
    );
};
