import { describe, it, expect } from 'vitest';
import { scoreHistory, normalizeAct, CATEGORIES } from './resistance.js';
import { HABIT_ACTIONS, habitActLabel } from './habitActs.js';

const entry = (cat, label, dayKey, createdAt) => ({
    cat, label, act: normalizeAct(label), mag: null, newContext: false, dayKey, createdAt,
});

describe('habit resistance acts', () => {
    it('covers every resistance category exactly once', () => {
        expect(HABIT_ACTIONS.map((a) => a.cat).sort()).toEqual(Object.keys(CATEGORIES).sort());
    });

    it('labels an act with the habit name', () => {
        expect(habitActLabel('N', ' Diet ')).toBe('Diet craving');
        expect(habitActLabel('P', 'Diet')).toBe('Diet: pushed past the no');
        expect(() => habitActLabel('X', 'Diet')).toThrow();
    });

    it('scores each habit as its own act, separate from the generic craving', () => {
        const day = '2026-01-01';
        const { results } = scoreHistory([
            entry('N', 'craving', day, 1),
            entry('N', habitActLabel('N', 'Diet'), day, 2),
            entry('N', habitActLabel('N', 'Diet'), day, 3),
            entry('N', habitActLabel('N', 'Junk food'), day, 4),
            entry('P', habitActLabel('P', 'Diet'), day, 5),
        ], 40);
        expect(results.map((r) => r.value)).toEqual([1, 1, 0, 1, 2]);
        expect(results[2].reason).toBe('already logged today');
    });
});
