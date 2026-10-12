/**
 * GET /api/admin/usage            (administrators only)
 *
 * How many Firestore reads and writes the project has used, against Firebase's
 * free daily allowance — so the client can see for himself how much the portal
 * costs to run and when it is heading for a limit.
 *
 * The numbers come from Google Cloud Monitoring, the same source as the graph in
 * the Firebase console's Usage tab, so they match it. Counts cover everything
 * that touches the database: students taking tests, the admin screens, reports.
 *
 * Needs the server's service account to be allowed to read monitoring data
 * ("Monitoring Viewer") and the Cloud Monitoring API to be on for the project.
 * If either is missing this does not fail: it answers { available: false } with
 * the exact thing to switch on, and the admin screen shows that instead.
 *
 * Reading these metrics is free and does not use any Firestore reads.
 */
import { requireAdmin, adminProjectId, getAdminAccessToken } from '../../../lib/firebaseAdmin.js';
import { FREE_LIMITS, pacificDateKey, pacificDayStart } from '../../../src/utils/usageLimits.js';

const DAYS_BACK = 8;
const METRICS = {
    reads: 'firestore.googleapis.com/document/read_count',
    writes: 'firestore.googleapis.com/document/write_count'
};

// Monitoring answers a little late and is itself rate limited; a minute of
// caching per server instance keeps repeated refreshes cheap.
let cache = null;
const CACHE_MS = 60 * 1000;

async function fetchHourly(projectId, token, metricType, startIso, endIso) {
    const params = new URLSearchParams({
        filter: `metric.type="${metricType}"`,
        'interval.startTime': startIso,
        'interval.endTime': endIso,
        'aggregation.alignmentPeriod': '3600s',
        'aggregation.perSeriesAligner': 'ALIGN_SUM',
        'aggregation.crossSeriesReducer': 'REDUCE_SUM'
    });
    const res = await fetch(`https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json();
    if (!res.ok) {
        const err = new Error(json?.error?.message || `Monitoring request failed (${res.status})`);
        err.httpStatus = res.status;
        err.status = json?.error?.status;
        throw err;
    }
    const points = [];
    (json.timeSeries || []).forEach(series => (series.points || []).forEach(p => {
        const v = p.value || {};
        const count = Number(v.int64Value ?? v.doubleValue ?? 0);
        points.push({ end: new Date(p.interval.endTime), count });
    }));
    return points;
}

function explainFailure(err) {
    const msg = String(err.message || '');
    if (/has not been used in project|SERVICE_DISABLED|is disabled/i.test(msg)) {
        return {
            reason: 'api-disabled',
            message: 'Usage numbers need one switch turned on. In Google Cloud Console, open APIs & Services, search for "Cloud Monitoring API" and press Enable.'
        };
    }
    if (err.httpStatus === 403 || err.status === 'PERMISSION_DENIED' || /permission/i.test(msg)) {
        return {
            reason: 'permission',
            message: 'Usage numbers need one permission. In Google Cloud Console, open IAM, find the Firebase service account (the one whose key is in Vercel) and add the role "Monitoring Viewer".'
        };
    }
    return { reason: 'error', message: 'Could not load the usage numbers right now. Please try again in a minute.' };
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const caller = await requireAdmin(req, res);
    if (!caller) return;

    if (cache && Date.now() - cache.at < CACHE_MS) {
        res.status(200).json(cache.body);
        return;
    }

    try {
        const projectId = adminProjectId();
        if (!projectId) throw new Error('Could not work out the Google Cloud project id.');
        const token = await getAdminAccessToken();

        const now = new Date();
        const start = new Date(now.getTime() - DAYS_BACK * 24 * 60 * 60 * 1000);
        const [reads, writes] = await Promise.all([
            fetchHourly(projectId, token, METRICS.reads, start.toISOString(), now.toISOString()),
            fetchHourly(projectId, token, METRICS.writes, start.toISOString(), now.toISOString())
        ]);

        // Bucket by Pacific-Time day, which is what Firebase's daily limit uses.
        const byDay = {};
        const bump = (list, kind) => list.forEach(p => {
            // An hourly point covers the hour BEFORE its end time.
            const key = pacificDateKey(new Date(p.end.getTime() - 1));
            (byDay[key] ||= { date: key, reads: 0, writes: 0 })[kind] += p.count;
        });
        bump(reads, 'reads');
        bump(writes, 'writes');

        const todayKey = pacificDateKey(now);
        const days = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
        const today = byDay[todayKey] || { date: todayKey, reads: 0, writes: 0 };

        const body = {
            available: true,
            asOf: now.toISOString(),
            dayStartedAt: pacificDayStart(now).toISOString(),
            limits: FREE_LIMITS,
            today: { reads: today.reads, writes: today.writes },
            days
        };
        cache = { at: Date.now(), body };
        res.status(200).json(body);
    } catch (err) {
        console.error('[admin/usage] Failed:', err.httpStatus || '', err.message);
        res.status(200).json({ available: false, limits: FREE_LIMITS, ...explainFailure(err) });
    }
}
