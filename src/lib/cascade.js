// Habit cascade engine. Pure functions only (no Firebase, no DOM).
//
// Strength reuses the Resistance Index recurrence from resistance.js:
//   c  = repeats banked: +1 per logged day, each un-logged day releases 0.5
//   resistance value fades as exp(-c / tau), tau = fadeDays / ln(50)
//   habit strength is the complement: 1 - exp(-c / tau)
// The cascade (CASCADE_BOOST) is a design assumption layered on top: habits
// linked as helpers shorten the fade horizon of the habit they support.

import { daysBetween, addDays, localDayKey, DEFAULT_FADE_DAYS } from './resistance.js';

// Default foundation habits, seeded into `habits` for every user (see defaultHabits.js).
export const ROOTS = [
    { id: 'sleep', name: 'Sleep', perWeek: 7, goalType: 'numeric', target: 8, unit: 'hours' },
    { id: 'exercise', name: 'Exercise', perWeek: 6, goalType: 'numeric', target: 20, unit: 'minutes' },
    { id: 'diet', name: 'Diet', perWeek: 7, goalType: 'negative', target: null, unit: null },
];

export const KINDS = {
    root: { label: 'Foundation', color: '#0d9488' },
    habit: { label: 'Habit', color: '#884dff' },
    outcome: { label: 'Consequence', color: '#ff3377' },
};

// The role is a tag on the habit (habits.labels). One source of truth.
export const ROLE_LABELS = { root: 'foundation', outcome: 'consequence' };
const norm = (x) => String(x).trim().toLowerCase();

export function roleOf(labels) {
    const l = (labels || []).map(norm);
    if (l.includes(ROLE_LABELS.root)) return 'root';
    return l.includes(ROLE_LABELS.outcome) ? 'outcome' : 'habit';
}

export function labelsForRole(labels, role) {
    const rest = (labels || []).filter((x) => !Object.values(ROLE_LABELS).includes(norm(x)));
    return ROLE_LABELS[role] ? [...rest, ROLE_LABELS[role]] : rest;
}

export const CASCADE_BOOST = 0.5; // fully formed helpers halve the horizon
export const ROUTINE_AT = 0.75;
export const LOCKED_AT = 0.95;
export const SLIP_DAYS = 2;

export function clampPerWeek(n) {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.min(7, Math.max(1, v)) : 7;
}

/**
 * Replay check-in days into repeats banked.
 * A habit done N times a week gets (7 - N) / N free gap days per log before
 * the 0.5/day release applies; N = 7 matches resistance.js exactly.
 * Returns { c, lastDay, overdue } - overdue is un-logged days beyond the free gap.
 */
export function replayDays(days, perWeek = 7, todayKey = localDayKey()) {
    const p = clampPerWeek(perWeek);
    const free = (7 - p) / p;
    const sorted = [...new Set(days || [])].filter((d) => d <= todayKey).sort();
    let c = 0;
    let lastDay = null;
    for (const d of sorted) {
        if (lastDay) {
            const gap = daysBetween(lastDay, d) - 1;
            c = Math.max(0, c - 0.5 * Math.max(0, gap - free));
        }
        c += 1;
        lastDay = d;
    }
    let overdue = 0;
    if (lastDay) {
        overdue = Math.max(0, daysBetween(lastDay, todayKey) - 1 - free);
        c = Math.max(0, c - 0.5 * overdue);
    }
    return { c, lastDay, overdue };
}

export function horizonFor(fadeDays, support = 0) {
    return fadeDays * (1 - CASCADE_BOOST * Math.min(1, Math.max(0, support)));
}

export function strengthFor(c, fadeDays, support = 0) {
    return 1 - Math.exp((-c * Math.log(50)) / horizonFor(fadeDays, support));
}

// Everything reachable downstream of id (the nodes it helps, transitively).
export function descendantsOf(id, nodes) {
    const out = new Set();
    const queue = [id];
    while (queue.length) {
        const cur = queue.shift();
        for (const n of nodes) {
            if ((n.helpedBy || []).includes(cur) && !out.has(n.id) && n.id !== id) {
                out.add(n.id);
                queue.push(n.id);
            }
        }
    }
    return out;
}

// Can helperId be linked as something that helps childId without a loop?
export function canHelp(helperId, childId, nodes) {
    const helper = nodes.find((n) => n.id === helperId);
    const child = nodes.find((n) => n.id === childId);
    if (!helper || !child || helperId === childId) return false;
    if (helper.kind === 'outcome' || child.kind === 'root') return false;
    return !descendantsOf(childId, nodes).has(helperId);
}

/**
 * nodes: [{ id, name, kind: 'root'|'habit'|'outcome', helpedBy, days, perWeek }]
 * Returns Map id -> node + { parents, level, c, support, horizon, strength,
 *                            status, loggedToday, atRisk }
 */
export function computeSystem(nodes, fadeDays = DEFAULT_FADE_DAYS, todayKey = localDayKey()) {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const parentsOf = (n) =>
        n.kind === 'root'
            ? []
            : [...new Set(n.helpedBy || [])].filter(
                (p) => p !== n.id && byId.has(p) && byId.get(p).kind !== 'outcome'
            );

    // Longest-path layer; a back-edge (bad data) is ignored instead of looping.
    const level = new Map();
    const visiting = new Set();
    const levelOf = (id) => {
        if (level.has(id)) return level.get(id);
        if (visiting.has(id)) return 0;
        visiting.add(id);
        const n = byId.get(id);
        const ps = parentsOf(n);
        const l = n.kind === 'root' ? 0 : 1 + Math.max(0, ...ps.map(levelOf));
        visiting.delete(id);
        level.set(id, l);
        return l;
    };
    nodes.forEach((n) => levelOf(n.id));
    const top = Math.max(0, ...nodes.filter((n) => n.kind !== 'outcome').map((n) => level.get(n.id)));
    nodes.forEach((n) => { if (n.kind === 'outcome') level.set(n.id, top + 1); });

    const out = new Map();
    const ordered = [...nodes].sort((a, b) => level.get(a.id) - level.get(b.id));
    for (const n of ordered) {
        const parents = parentsOf(n).filter((p) => out.has(p));
        const support = parents.length
            ? parents.reduce((s, p) => s + out.get(p).strength, 0) / parents.length
            : 0;
        const atRisk = parents.some((p) => out.get(p).status === 'slipping' || out.get(p).atRisk);
        let c = null, strength, status, loggedToday = false, horizon = null;
        if (n.kind === 'outcome') {
            strength = support;
            status = parents.length ? 'supported' : 'unlinked';
        } else {
            const r = replayDays(n.days, n.perWeek, todayKey);
            c = r.c;
            horizon = horizonFor(fadeDays, support);
            strength = strengthFor(c, fadeDays, support);
            loggedToday = (n.days || []).includes(todayKey);
            if (!r.lastDay) status = 'not started';
            else if (r.overdue >= SLIP_DAYS) status = 'slipping';
            else if (strength >= LOCKED_AT) status = 'locked in';
            else if (strength >= ROUTINE_AT) status = 'routine';
            else status = 'building';
        }
        out.set(n.id, {
            ...n, parents, level: level.get(n.id), c, support, horizon, strength, status, loggedToday, atRisk,
        });
    }
    return out;
}

export const NODE_H = 76;
const ROW_GAP = 56;
const COL_GAP = 12;
const MIN_W = 96;
const MAX_W = 160;

/**
 * Roots on the bottom row, consequences on the top row.
 * Returns { width, height, nodeW, boxes: Map id -> {x, y}, edges: [{from, to, d}] }
 */
export function layoutSystem(sys, containerWidth) {
    const rows = new Map();
    for (const n of sys.values()) {
        if (!rows.has(n.level)) rows.set(n.level, []);
        rows.get(n.level).push(n);
    }
    const maxLevel = Math.max(0, ...rows.keys());
    const maxCount = Math.max(1, ...[...rows.values()].map((r) => r.length));
    const usable = Math.max(containerWidth, MIN_W);
    const nodeW = Math.min(MAX_W, Math.max(MIN_W, (usable - (maxCount - 1) * COL_GAP) / maxCount));
    const width = Math.max(usable, maxCount * nodeW + (maxCount - 1) * COL_GAP);
    const height = (maxLevel + 1) * NODE_H + maxLevel * ROW_GAP;

    const boxes = new Map();
    const rootOrder = new Map(ROOTS.map((r, i) => [r.id, i]));
    for (let l = 0; l <= maxLevel; l++) {
        const row = rows.get(l) || [];
        const centre = (id) => boxes.get(id).x + nodeW / 2;
        const key = (n) => {
            if (n.kind === 'root') return n.order ?? rootOrder.get(n.id) ?? 99;
            return n.parents.length
                ? n.parents.reduce((s, p) => s + centre(p), 0) / n.parents.length
                : width / 2;
        };
        row.sort((a, b) => key(a) - key(b) || a.name.localeCompare(b.name));
        const slot = width / row.length;
        row.forEach((n, i) => {
            boxes.set(n.id, {
                x: slot * (i + 0.5) - nodeW / 2,
                y: (maxLevel - l) * (NODE_H + ROW_GAP),
            });
        });
    }

    const edges = [];
    for (const n of sys.values()) {
        for (const p of n.parents) {
            const a = boxes.get(p), b = boxes.get(n.id);
            const x1 = a.x + nodeW / 2, y1 = a.y;
            const x2 = b.x + nodeW / 2, y2 = b.y + NODE_H;
            const k = (y1 - y2) / 2;
            edges.push({ from: p, to: n.id, d: `M${x1},${y1} C${x1},${y1 - k} ${x2},${y2 + k} ${x2},${y2}` });
        }
    }
    return { width, height, nodeW, boxes, edges };
}

export function lastDays(n, todayKey = localDayKey()) {
    return [...Array(n)].map((_, i) => addDays(todayKey, i - (n - 1)));
}
