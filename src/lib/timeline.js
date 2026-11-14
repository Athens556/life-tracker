// Timeline helpers. Pure (no Firebase, no React) so they can be tested.
export const DEFAULT_BLOCK_MINUTES = 30;

export const timeToMinutes = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return ((h * 60 + m) % 1440 + 1440) % 1440;
};

export const minutesToTime = (mins) => {
    const m = ((Math.round(mins) % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

// "15 min" -> 15, "1 hour" -> 60, "2+ hours" -> 120, anything else -> null.
export function parseTimeRequired(str) {
    const m = /(\d+(?:\.\d+)?)\s*\+?\s*(min|hour|hr)/i.exec(str || '');
    if (!m) return null;
    return Math.round(parseFloat(m[1]) * (m[2].toLowerCase() === 'min' ? 1 : 60));
}

// How long one habit takes: its Time field, else a numeric target in hours or minutes.
export function habitMinutes(habit) {
    const fromTime = parseTimeRequired(habit.timeRequired);
    if (fromTime) return fromTime;
    if (habit.goalType === 'numeric' && habit.target > 0) {
        const unit = String(habit.unit || '').trim().toLowerCase();
        if (/^(h|hr|hrs|hour|hours)$/.test(unit)) return Math.round(habit.target * 60);
        if (/^(m|min|mins|minute|minutes)$/.test(unit)) return Math.round(habit.target);
    }
    return null;
}

// A unit (habit or complementary folder) takes as long as its longest member.
export function unitMinutes(unit) {
    const known = unit.members.map(habitMinutes).filter(Boolean);
    return known.length ? Math.max(...known) : DEFAULT_BLOCK_MINUTES;
}

export function clampDuration(n) {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.min(1440, Math.max(5, v)) : DEFAULT_BLOCK_MINUTES;
}

// One segment, or two when the block passes midnight. Minutes within 0..1440.
export function daySegments(startMinutes, duration) {
    const start = ((Math.round(startMinutes) % 1440) + 1440) % 1440;
    const end = start + Math.min(Math.max(0, duration), 1440);
    return end <= 1440 ? [{ start, end }] : [{ start, end: 1440 }, { start: 0, end: end - 1440 }];
}

/**
 * Stored entries -> [{ unitId, startTime, duration, legacy }], one per unit.
 * Old entries used `habitId` (and a wrong duration): they are marked legacy.
 * toUnit maps a habit id to the unit that now represents it.
 */
export function normaliseSchedule(entries, toUnit = new Map()) {
    const seen = new Set();
    const out = [];
    for (const e of entries || []) {
        const raw = e.unitId ?? e.habitId;
        if (!raw || !e.startTime) continue;
        const unitId = toUnit.get(raw) || raw;
        if (seen.has(unitId)) continue;
        seen.add(unitId);
        out.push({ unitId, startTime: e.startTime, duration: clampDuration(e.duration), legacy: !e.unitId });
    }
    return out;
}

export function freeMinutes(profile, schedule = []) {
    const work = (timeToMinutes(profile.workEnd) - timeToMinutes(profile.workStart) + 1440) % 1440;
    const used = work + (profile.commuteMinutes || 0) + (profile.morningRoutineMinutes || 0)
        + (profile.miscMinutes || 0) + schedule.reduce((s, e) => s + e.duration, 0);
    return Math.max(0, 1440 - used);
}
