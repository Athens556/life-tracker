import { describe, it, expect } from 'vitest';
import {
    parseTimeRequired, habitMinutes, unitMinutes, daySegments, normaliseSchedule, freeMinutes,
    timeToMinutes, minutesToTime, clampDuration, DEFAULT_BLOCK_MINUTES,
} from './timeline.js';

describe('block length', () => {
    it('reads the Time field correctly', () => {
        expect(parseTimeRequired('5 min')).toBe(5);
        expect(parseTimeRequired('1 hour')).toBe(60);
        expect(parseTimeRequired('2+ hours')).toBe(120);
        expect(parseTimeRequired(null)).toBeNull();
    });

    it('falls back to a numeric target in hours or minutes', () => {
        expect(habitMinutes({ goalType: 'numeric', target: 8, unit: 'hours' })).toBe(480);
        expect(habitMinutes({ goalType: 'numeric', target: 20, unit: 'minutes' })).toBe(20);
        expect(habitMinutes({ goalType: 'numeric', target: 10000, unit: 'steps' })).toBeNull();
        expect(habitMinutes({ timeRequired: '30 min', goalType: 'numeric', target: 8, unit: 'hours' })).toBe(30);
    });

    it('a unit takes its longest member, default 30', () => {
        expect(unitMinutes({ members: [{ timeRequired: '15 min' }, { timeRequired: '1 hour' }] })).toBe(60);
        expect(unitMinutes({ members: [{}] })).toBe(DEFAULT_BLOCK_MINUTES);
        expect(clampDuration('abc')).toBe(DEFAULT_BLOCK_MINUTES);
        expect(clampDuration(1)).toBe(5);
    });
});

describe('day maths', () => {
    it('converts times both ways', () => {
        expect(timeToMinutes('23:30')).toBe(1410);
        expect(minutesToTime(1410 + 60)).toBe('00:30');
        expect(minutesToTime(-30)).toBe('23:30');
    });

    it('splits a block that passes midnight', () => {
        expect(daySegments(600, 60)).toEqual([{ start: 600, end: 660 }]);
        expect(daySegments(1380, 480)).toEqual([{ start: 1380, end: 1440 }, { start: 0, end: 420 }]);
        expect(daySegments(-30, 60)).toEqual([{ start: 1410, end: 1440 }, { start: 0, end: 30 }]);
    });

    it('free time subtracts work, fixed blocks and scheduled blocks', () => {
        const profile = { workStart: '09:00', workEnd: '18:00', commuteMinutes: 60, morningRoutineMinutes: 30, miscMinutes: 120 };
        expect(freeMinutes(profile)).toBe(1440 - 540 - 210);
        expect(freeMinutes(profile, [{ duration: 480 }, { duration: 60 }])).toBe(1440 - 540 - 210 - 540);
    });
});

describe('normaliseSchedule', () => {
    it('reads old habitId entries, maps members to their folder unit, and dedupes', () => {
        const toUnit = new Map([['m', 'folder:Study'], ['p', 'folder:Study'], ['g', 'g']]);
        const out = normaliseSchedule([
            { habitId: 'm', habitName: 'Maths', startTime: '19:00', duration: 1 },
            { habitId: 'p', startTime: '20:00', duration: 15 },
            { unitId: 'g', startTime: '06:00', duration: 45 },
            { unitId: 'x' },
        ], toUnit);
        expect(out).toEqual([
            { unitId: 'folder:Study', startTime: '19:00', duration: 5, legacy: true },
            { unitId: 'g', startTime: '06:00', duration: 45, legacy: false },
        ]);
    });
});
