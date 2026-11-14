import { describe, it, expect } from 'vitest';
import { scoreHistory, addDays, daysBetween } from './resistance.js';
import {
    ROOTS, replayDays, strengthFor, horizonFor, computeSystem, layoutSystem,
    canHelp, descendantsOf, CASCADE_BOOST, roleOf, labelsForRole,
} from './cascade.js';

const D0 = '2026-01-01';
const day = (n) => addDays(D0, n);
const range = (a, b) => [...Array(b - a + 1)].map((_, i) => day(a + i));
const roots = (days = {}) =>
    ROOTS.map((r) => ({ ...r, kind: 'root', helpedBy: [], days: days[r.id] || [] }));

describe('replayDays', () => {
    it('matches the resistance.js recurrence for a daily habit', () => {
        const days = [0, 1, 2, 5, 6, 12, 13, 14, 15].map(day);
        const today = day(18);
        const entries = days.map((d, i) => ({
            cat: 'P', act: 'x', label: 'x', mag: null, newContext: false, dayKey: d, createdAt: i,
        }));
        const g = scoreHistory(entries, 40).groups.get('P|x');
        const gap = daysBetween(g.lastDay, today) - 1;
        const expected = Math.max(0, g.c - 0.5 * Math.max(0, gap));
        expect(replayDays(days, 7, today).c).toBeCloseTo(expected, 10);
    });

    it('a missed day costs half a day, not the streak', () => {
        const days = [...range(0, 9), ...range(11, 12)];
        expect(replayDays(days, 7, day(12)).c).toBeCloseTo(11.5, 10);
    });

    it('today not yet logged is not a miss', () => {
        const r = replayDays(range(0, 4), 7, day(5));
        expect(r.c).toBe(5);
        expect(r.overdue).toBe(0);
    });

    it('a twice-a-week habit still builds', () => {
        const days = [0, 3, 7, 10, 14, 17].map(day);
        expect(replayDays(days, 2, day(17)).c).toBeGreaterThan(5);
        expect(replayDays(days, 7, day(17)).c).toBeLessThan(2);
    });

    it('ignores duplicates and future days', () => {
        expect(replayDays([day(0), day(0), day(9)], 7, day(0)).c).toBe(1);
    });
});

describe('strength', () => {
    it('is the complement of the resistance fade: 98% at the horizon', () => {
        expect(strengthFor(0, 40)).toBe(0);
        expect(strengthFor(40, 40)).toBeCloseTo(0.98, 10);
    });

    it('full support shrinks the horizon by CASCADE_BOOST', () => {
        expect(horizonFor(40, 1)).toBe(40 * (1 - CASCADE_BOOST));
        expect(strengthFor(20, 40, 1)).toBeCloseTo(0.98, 10);
        expect(strengthFor(10, 40, 0.5)).toBeGreaterThan(strengthFor(10, 40, 0));
    });
});

describe('computeSystem', () => {
    const today = day(29);
    const nodes = [
        ...roots({ sleep: range(0, 29), exercise: range(0, 10) }),
        { id: 'study', name: 'Study', kind: 'habit', helpedBy: ['sleep', 'exercise'], days: range(20, 29), perWeek: 7 },
        { id: 'solo', name: 'Solo', kind: 'habit', helpedBy: [], days: range(20, 29), perWeek: 7 },
        { id: 'memory', name: 'Better memory', kind: 'outcome', helpedBy: ['study', 'ghost'] },
    ];
    const sys = computeSystem(nodes, 40, today);

    it('layers roots, habits and consequences', () => {
        expect(sys.get('sleep').level).toBe(0);
        expect(sys.get('study').level).toBe(1);
        expect(sys.get('memory').level).toBe(2);
        expect(sys.get('memory').parents).toEqual(['study']);
    });

    it('a supported habit is stronger than an unsupported one with the same log', () => {
        expect(sys.get('study').support).toBeGreaterThan(0);
        expect(sys.get('study').strength).toBeGreaterThan(sys.get('solo').strength);
    });

    it('a slipping root puts downstream nodes at risk', () => {
        expect(sys.get('exercise').status).toBe('slipping');
        expect(sys.get('study').atRisk).toBe(true);
        expect(sys.get('memory').atRisk).toBe(true);
        expect(sys.get('solo').atRisk).toBe(false);
    });

    it('a consequence mirrors the strength of its habits', () => {
        expect(sys.get('memory').strength).toBeCloseTo(sys.get('study').strength, 10);
        expect(sys.get('diet').status).toBe('not started');
        expect(sys.get('sleep').loggedToday).toBe(true);
    });

    it('survives a loop in stored data', () => {
        const loop = [
            ...roots(),
            { id: 'a', name: 'A', kind: 'habit', helpedBy: ['b'], days: [] },
            { id: 'b', name: 'B', kind: 'habit', helpedBy: ['a'], days: [] },
        ];
        expect(computeSystem(loop, 40, today).size).toBe(5);
    });
});

describe('links', () => {
    const nodes = [
        ...roots(),
        { id: 'a', name: 'A', kind: 'habit', helpedBy: ['sleep'] },
        { id: 'b', name: 'B', kind: 'habit', helpedBy: ['a'] },
        { id: 'o', name: 'O', kind: 'outcome', helpedBy: ['b'] },
    ];

    it('finds everything downstream', () => {
        expect([...descendantsOf('sleep', nodes)].sort()).toEqual(['a', 'b', 'o']);
    });

    it('refuses loops, consequences as helpers, and helpers for roots', () => {
        expect(canHelp('b', 'a', nodes)).toBe(false);
        expect(canHelp('a', 'a', nodes)).toBe(false);
        expect(canHelp('o', 'a', nodes)).toBe(false);
        expect(canHelp('a', 'sleep', nodes)).toBe(false);
        expect(canHelp('exercise', 'b', nodes)).toBe(true);
    });
});

describe('layoutSystem', () => {
    it('puts roots on the bottom row and keeps boxes inside the canvas', () => {
        const nodes = [
            ...roots(),
            { id: 'a', name: 'A', kind: 'habit', helpedBy: ['sleep'], days: [] },
            { id: 'o', name: 'O', kind: 'outcome', helpedBy: ['a'] },
        ];
        const sys = computeSystem(nodes, 40, D0);
        const lay = layoutSystem(sys, 330);
        expect(lay.boxes.get('sleep').y).toBeGreaterThan(lay.boxes.get('a').y);
        expect(lay.boxes.get('a').y).toBeGreaterThan(lay.boxes.get('o').y);
        expect(lay.boxes.get('sleep').x).toBeLessThan(lay.boxes.get('exercise').x);
        for (const b of lay.boxes.values()) {
            expect(b.x).toBeGreaterThanOrEqual(0);
            expect(b.x + lay.nodeW).toBeLessThanOrEqual(lay.width + 0.001);
        }
        expect(lay.edges).toHaveLength(2);
    });
});

describe('roles are tags on the habit', () => {
    it('reads the role from labels', () => {
        expect(roleOf(['Foundation', 'health'])).toBe('root');
        expect(roleOf(['consequence'])).toBe('outcome');
        expect(roleOf(null)).toBe('habit');
    });

    it('swaps the role tag and keeps other labels', () => {
        expect(labelsForRole(['health', 'foundation'], 'outcome')).toEqual(['health', 'consequence']);
        expect(labelsForRole(['Foundation', 'x'], 'habit')).toEqual(['x']);
    });
});

describe('default habits', () => {
    it('sleep and exercise are numeric, diet is negative', () => {
        const by = Object.fromEntries(ROOTS.map((r) => [r.id, r]));
        expect(by.sleep).toMatchObject({ goalType: 'numeric', target: 8, unit: 'hours' });
        expect(by.exercise.goalType).toBe('numeric');
        expect(by.exercise.target).toBeGreaterThan(0);
        expect(by.diet).toMatchObject({ goalType: 'negative', target: null });
    });
});
