// Resistance Index scoring engine.
// Pure functions only — all scoring is replayed client-side from raw history
// so changing fadeDays retroactively rescores everything.

export const CATEGORIES = {
    N: { name: 'Said no', base: 1, fades: true, mult: 3, color: '#884dff' },
    P: { name: 'Pushed past the no', base: 2, fades: true, mult: 1, color: '#ff3377' },
    C: { name: 'Cut the cascade', base: 3, fades: true, mult: 1, color: '#0d9488' },
    R: { name: 'Came back same day', base: 3, fades: false, mult: 1, color: '#b45309' },
};

export const DEFAULT_FADE_DAYS = 40;
export const MIN_FADE_DAYS = 7;
export const MAX_FADE_DAYS = 120;

// Identity used to match repeats: lowercase, numbers stripped, whitespace collapsed.
export function normalizeAct(label) {
    return label
        .toLowerCase()
        .replace(/\d+(\.\d+)?/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// First number found in the label, or null.
export function extractMag(label) {
    const m = label.match(/\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
}

// "YYYY-MM-DD" in the device's local timezone — a 1 a.m. entry belongs to the
// night it happened, so this must NOT use toISOString (UTC).
export function localDayKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function dayKeyToDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function daysBetween(keyA, keyB) {
    return Math.round((dayKeyToDate(keyB) - dayKeyToDate(keyA)) / 86400000);
}

export function addDays(key, n) {
    const d = dayKeyToDate(key);
    d.setDate(d.getDate() + n);
    return localDayKey(d);
}

const round1 = (v) => Math.round(v * 10) / 10;

function tauFor(cat, fadeDays) {
    return (fadeDays * CATEGORIES[cat].mult) / Math.log(50);
}

function fadedValue(cat, c, fadeDays) {
    const def = CATEGORIES[cat];
    if (!def.fades) return def.base;
    return round1(def.base * Math.exp(-c / tauFor(cat, fadeDays)));
}

function reasonForFade(cat, value) {
    const def = CATEGORIES[cat];
    if (value >= def.base) return null;
    return value < 0.5 ? 'routine now' : `faded from ${def.base}`;
}

/**
 * Replay full history and score every entry.
 *
 * entries: [{ id?, cat, act, mag, newContext, dayKey, createdAt (ms) }]
 * Returns:
 *   results — entries sorted chronologically, each with { value, reason }
 *   groups  — Map "cat|act" -> { c, bestMag, lastDay, lastLabel } (state after replay)
 */
export function scoreHistory(entries, fadeDays) {
    const sorted = [...entries].sort(
        (a, b) => a.dayKey.localeCompare(b.dayKey) || (a.createdAt || 0) - (b.createdAt || 0)
    );
    const groups = new Map();
    const results = [];

    for (const e of sorted) {
        const key = `${e.cat}|${e.act}`;
        let g = groups.get(key);
        if (!g) {
            g = { c: 0, bestMag: null, lastDay: null, lastLabel: e.label };
            groups.set(key, g);
        }
        g.lastLabel = e.label;

        let value;
        let reason = null;

        if (g.lastDay === e.dayKey) {
            // Once-per-day ceiling: stored, but scores 0.
            value = 0;
            reason = 'already logged today';
        } else {
            // Recovery: each un-logged day between logs releases 0.5 — half the
            // build-up rate, so deep routine returns slowly.
            if (g.lastDay !== null) {
                const gap = daysBetween(g.lastDay, e.dayKey) - 1;
                if (gap > 0) g.c = Math.max(0, g.c - 0.5 * gap);
            }

            // Modifiers apply to c BEFORE the increment.
            if (e.newContext) {
                g.c = 0;
                reason = 'new context — full value';
            } else if (
                e.mag != null &&
                g.bestMag != null &&
                e.mag >= 1.10 * g.bestMag
            ) {
                g.c *= 0.5;
                reason = 'new best — fade halved';
            }

            value = fadedValue(e.cat, g.c, fadeDays);
            if (!reason) reason = reasonForFade(e.cat, value);

            g.c += 1;
            g.lastDay = e.dayKey;
        }

        if (e.mag != null && (g.bestMag == null || e.mag > g.bestMag)) {
            g.bestMag = e.mag;
        }

        results.push({ ...e, value, reason });
    }

    return { results, groups };
}

/**
 * What a (cat, act) would score if logged right now, given replayed state.
 * Returns { value, reason } — value 0 with 'already logged today' if capped.
 */
export function liveValue(cat, act, groups, fadeDays, todayKey = localDayKey()) {
    const def = CATEGORIES[cat];
    const g = groups.get(`${cat}|${act}`);
    if (!g) return { value: def.base, reason: null };
    if (g.lastDay === todayKey) return { value: 0, reason: 'already logged today' };

    let c = g.c;
    const gap = daysBetween(g.lastDay, todayKey) - 1;
    if (gap > 0) c = Math.max(0, c - 0.5 * gap);

    const value = fadedValue(cat, c, fadeDays);
    return { value, reason: reasonForFade(cat, value) };
}

export function clampFadeDays(n) {
    if (!Number.isFinite(n)) return DEFAULT_FADE_DAYS;
    return Math.min(MAX_FADE_DAYS, Math.max(MIN_FADE_DAYS, Math.round(n)));
}
