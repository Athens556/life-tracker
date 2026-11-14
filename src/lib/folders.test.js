import { describe, it, expect } from 'vitest';
import { habitUnits, unitDoneOn, folderTypeOf, unitIdByHabit, folderUnitId, NO_FOLDER } from './folders.js';

const habits = [
    { id: 'm', text: 'Maths', category: 'Study', completedDates: ['2026-01-01', '2026-01-03'] },
    { id: 'p', text: 'Physics', category: 'Study', completedDates: ['2026-01-02', '2026-01-03'] },
    { id: 'g', text: 'Gym', category: 'Health', completedDates: ['2026-01-01'] },
    { id: 'w', text: 'Water', completedDates: [] },
];
const folders = new Map([['Study', { name: 'Study', type: 'complementary' }], [NO_FOLDER, { type: 'complementary' }]]);

describe('folder types', () => {
    it('defaults to mandatory, and the no-folder bucket is never complementary', () => {
        expect(folderTypeOf(folders, 'Study')).toBe('complementary');
        expect(folderTypeOf(folders, 'Health')).toBe('mandatory');
        expect(folderTypeOf(folders, NO_FOLDER)).toBe('mandatory');
        expect(folderTypeOf(undefined, 'Study')).toBe('mandatory');
    });

    it('a complementary folder is one unit, done when any member is done', () => {
        const units = habitUnits(habits, folders);
        expect(units.map((u) => u.id)).toEqual([folderUnitId('Study'), 'g', 'w']);
        const study = units[0];
        expect(study.members.map((m) => m.text)).toEqual(['Maths', 'Physics']);
        expect(study.completedDates).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
        expect(unitDoneOn(study, '2026-01-02')).toBe(true);
        expect(unitDoneOn(study, '2026-01-04')).toBe(false);
    });

    it('with no folder docs every habit is its own unit', () => {
        expect(habitUnits(habits, new Map()).map((u) => u.id)).toEqual(['m', 'p', 'g', 'w']);
    });

    it('maps member habits to the unit that represents them', () => {
        const map = unitIdByHabit(habitUnits(habits, folders));
        expect(map.get('m')).toBe(folderUnitId('Study'));
        expect(map.get('g')).toBe('g');
    });
});
