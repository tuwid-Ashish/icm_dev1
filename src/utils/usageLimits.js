/**
 * Firebase's free daily allowance, and the small date maths the usage screens
 * need. Pure functions — safe to use in the browser and in API routes.
 *
 * Firestore counts a "day" in Pacific Time, so the free allowance resets at
 * midnight there (about 12:30 PM in India while the US is on daylight time,
 * 1:30 PM after it ends). Everything here works in that day, not the Indian one,
 * so the numbers match the Firebase console.
 */

// Firebase's free (no-cost) allowance per day. On the pay-as-you-go plan the
// same amount is still free every day; only usage beyond it is billed.
export const FREE_LIMITS = { reads: 50000, writes: 20000 };

// Approximate prices beyond the free allowance, in rupees per 1,00,000
// operations (Firebase list price in US dollars, converted roughly). Shown as an
// estimate only.
export const APPROX_RUPEES_PER_LAKH = { reads: 5, writes: 16 };

const PT = 'America/Los_Angeles';

/** The Pacific-Time calendar date (YYYY-MM-DD) that `date` falls on. */
export function pacificDateKey(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: PT, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** The instant midnight Pacific Time began for the day containing `date`. */
export function pacificDayStart(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: PT, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(date);
    const get = (type) => Number(parts.find(p => p.type === type).value);
    const msIntoDay = ((get('hour') * 60 + get('minute')) * 60 + get('second')) * 1000 + date.getMilliseconds();
    return new Date(date.getTime() - msIntoDay);
}

/** When the free allowance next resets (the next Pacific midnight). */
export function nextReset(date = new Date()) {
    return new Date(pacificDayStart(date).getTime() + 24 * 60 * 60 * 1000);
}

/** "12:30 PM" in Indian time, for telling the admin when the limit resets. */
export function formatResetTimeIST(date = new Date()) {
    return nextReset(date).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
}

/** Rough extra cost in rupees for `extra` operations over the free allowance. */
export function approxExtraCostRupees(extra, kind) {
    if (!extra || extra <= 0) return 0;
    return (extra / 100000) * APPROX_RUPEES_PER_LAKH[kind];
}

export const formatNumber = (n) => Number(n || 0).toLocaleString('en-IN');

/** 'ok' under 60%, 'warn' 60-99%, 'over' at or beyond the limit. */
export function usageStatus(used, limit) {
    if (used >= limit) return 'over';
    if (used >= limit * 0.6) return 'warn';
    return 'ok';
}
