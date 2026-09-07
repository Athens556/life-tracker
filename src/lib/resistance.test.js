import { describe, it, expect } from 'vitest';
import {
    scoreHistory,
    liveValue,
    normalizeAct,
    extractMag,
    localDayKey,
    addDays,
    CATEGORIES,
} from './resistance.js';

const D0 = '2026-01-01';
const day = (n) => addDays(D0, n);

let seq = 0;
function mk(cat, label, dayKey, opts = {}) {
    return {
        id: `e${seq}`,
        cat,
        label,
        act: normalizeAct(label),
        mag: extractMag(label),
        newContext: opts.newContext || false,
        dayKey,
        createdAt: opts.createdAt ?? ++seq,
    };
}

const values = (entries, fadeDays = 7) =>
    scoreHistory(entries, fadeDays).results.map((r) => r.value);

describe('normalizeAct / extractMag', () => {
    it('lowercases, strips numbers, collapses whitespace', () => {
        expect(normalizeAct('Run 1.05 km')).toBe('run km');
        expect(normalizeAct('  Said NO to 2nd   coffee ')).toBe('said no to nd coffee');
    });

    it('extracts the first number or null', () => {
        expect(extractMag('run 1.05 km')).toBe(1.05);
        expect(extractMag('no coffee')).toBeNull();
        expect(extractMag('did 3 sets of 12')).toBe(3);
    });
});

describe('consecutive-day decay', () => {
    it('same act loses value each consecutive day', () => {
        const entries = [0, 1, 2, 3].map((n) => mk('P', 'run 1 km', day(n)));
        const v = values(entries);
        expect(v[0]).toBe(CATEGORIES.P.base); // first time: full value
        expect(v).toEqual([2, 1.1, 0.7, 0.4]);
        for (let i = 1; i < v.length; i++) expect(v[i]).toBeLessThan(v[i - 1]);
    });

    it('deep routine gets a "routine now" reason', () => {
        const entries = [0, 1, 2, 3].map((n) => mk('P', 'run 1 km', day(n)));
        const { results } = scoreHistory(entries, 7);
        expect(results[3].reason).toBe('routine now');
        expect(results[1].reason).toBe('faded from 2');
    });
});

describe('half-rate recovery', () => {
    it('recovers 0.5 per missed day — half the build rate', () => {
        // 3 consecutive logs build c to 3; skipping 2 days releases only 1.
        const entries = [
            mk('P', 'run 1 km', day(0)),
            mk('P', 'run 1 km', day(1)),
            mk('P', 'run 1 km', day(2)),
            mk('P', 'run 1 km', day(5)), // 2 un-logged days -> c = 3 - 1 = 2
        ];
        const v = values(entries);
        // c=2 is the same state as the 3rd consecutive day (c=2), so same value.
        expect(v[3]).toBe(v[2]);
    });

    it('counter never goes below zero', () => {
        const entries = [
            mk('P', 'run 1 km', day(0)),
            mk('P', 'run 1 km', day(1)),
            mk('P', 'run 1 km', day(100)), // long gap: c fully recovered to 0
        ];
        const v = values(entries);
        expect(v[2]).toBe(CATEGORIES.P.base);
    });
});

describe('new best (1.10x jump)', () => {
    it('halves the fade at exactly 1.10x the previous best', () => {
        const entries = [
            mk('P', 'run 1.0 km', day(0)),
            mk('P', 'run 1.1 km', day(1)), // 1.1 >= 1.10 * 1.0
        ];
        const { results } = scoreHistory(entries, 7);
        expect(results[1].reason).toBe('new best — fade halved');
        // c was 1, halved to 0.5 -> more than the plain c=1 value, less than full.
        expect(results[1].value).toBeGreaterThan(1.1);
        expect(results[1].value).toBeLessThan(2);
    });

    it('daily +0.05 escalation never triggers it', () => {
        const mags = [1.0, 1.05, 1.1, 1.15, 1.2];
        const entries = mags.map((m, n) => mk('P', `run ${m} km`, day(n)));
        const { results } = scoreHistory(entries, 7);
        for (const r of results) {
            expect(r.reason).not.toBe('new best — fade halved');
        }
    });

    it('a real jump against the running best does trigger', () => {
        const entries = [
            mk('P', 'run 1.0 km', day(0)),
            mk('P', 'run 1.05 km', day(1)), // best becomes 1.05, no trigger
            mk('P', 'run 1.2 km', day(2)), // 1.2 >= 1.10 * 1.05 = 1.155
        ];
        const { results } = scoreHistory(entries, 7);
        expect(results[1].reason).not.toBe('new best — fade halved');
        expect(results[2].reason).toBe('new best — fade halved');
    });
});

describe('new context', () => {
    it('resets the counter to zero — full value again', () => {
        const entries = [
            mk('P', 'run 1 km', day(0)),
            mk('P', 'run 1 km', day(1)),
            mk('P', 'run 1 km', day(2), { newContext: true }),
        ];
        const { results } = scoreHistory(entries, 7);
        expect(results[2].value).toBe(CATEGORIES.P.base);
        expect(results[2].reason).toBe('new context — full value');
    });

    it('the reset carries forward: next day fades from c=1, not c=3', () => {
        const entries = [
            mk('P', 'run 1 km', day(0)),
            mk('P', 'run 1 km', day(1)),
            mk('P', 'run 1 km', day(2), { newContext: true }),
            mk('P', 'run 1 km', day(3)),
        ];
        const v = values(entries);
        expect(v[3]).toBe(v[1]); // same state as the 2nd-ever log (c=1)
    });
});

describe('once-per-day ceiling', () => {
    it('a duplicate (cat, act) on the same day stores but scores 0', () => {
        const entries = [
            mk('N', 'no coffee', day(0), { createdAt: 1 }),
            mk('N', 'no coffee', day(0), { createdAt: 2 }),
        ];
        const { results } = scoreHistory(entries, 7);
        expect(results[0].value).toBe(1);
        expect(results[1].value).toBe(0);
        expect(results[1].reason).toBe('already logged today');
    });

    it('same act in a different category still scores', () => {
        const entries = [
            mk('N', 'dessert', day(0)),
            mk('C', 'dessert', day(0)),
        ];
        const v = values(entries);
        expect(v[0]).toBe(CATEGORIES.N.base);
        expect(v[1]).toBe(CATEGORIES.C.base);
    });
});

describe('R never fades', () => {
    it('a comeback is always worth full base points', () => {
        const entries = [...Array(10)].map((_, n) => mk('R', 'restarted after slip', day(n)));
        const v = values(entries);
        expect(v).toEqual(Array(10).fill(CATEGORIES.R.base));
    });

    it('but the once-per-day ceiling still applies to R', () => {
        const entries = [
            mk('R', 'restarted after slip', day(0), { createdAt: 1 }),
            mk('R', 'restarted after slip', day(0), { createdAt: 2 }),
        ];
        const v = values(entries);
        expect(v).toEqual([3, 0]);
    });
});

describe('N fades 3x slower than P/C', () => {
    it('after the same number of consecutive days, N retains a larger fraction', () => {
        const nEntries = [0, 1, 2].map((n) => mk('N', 'no coffee', day(n)));
        const pEntries = [0, 1, 2].map((n) => mk('P', 'extra rep', day(n)));
        const nFrac = values(nEntries)[2] / CATEGORIES.N.base;
        const pFrac = values(pEntries)[2] / CATEGORIES.P.base;
        expect(nFrac).toBeGreaterThan(pFrac);
    });
});

describe('liveValue', () => {
    it('is 0 when already logged today', () => {
        const today = localDayKey();
        const { groups } = scoreHistory([mk('N', 'no coffee', today)], 7);
        const lv = liveValue('N', 'no coffee', groups, 7, today);
        expect(lv.value).toBe(0);
        expect(lv.reason).toBe('already logged today');
    });

    it('applies pending recovery for un-logged days since the last log', () => {
        const today = localDayKey();
        const logs = [addDays(today, -5), addDays(today, -4), addDays(today, -3)]
            .map((d) => mk('P', 'run 1 km', d));
        const { groups } = scoreHistory(logs, 7);
        // c built to 3, then 2 full un-logged days -> c = 2 today
        const lv = liveValue('P', normalizeAct('run 1 km'), groups, 7, today);
        expect(lv.value).toBe(0.7);
    });

    it('an unseen act is worth full base', () => {
        const { groups } = scoreHistory([], 7);
        expect(liveValue('C', 'phone out of bedroom', groups, 7).value).toBe(3);
    });
});
