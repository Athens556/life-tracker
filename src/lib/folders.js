// Folder types. Pure (no Firebase) so every page and the tests share one definition.
// A folder's attributes live in the `habitFolders` collection; habits only carry
// the folder NAME in `category`.
export const FOLDER_TYPES = {
    mandatory: { label: 'Mandatory', hint: 'every habit counts on its own' },
    complementary: { label: 'Complementary', hint: 'any one habit counts for the day' },
};
export const NO_FOLDER = 'Uncategorized';

export const folderOf = (habit) => habit.category || NO_FOLDER;

// folders: Map name -> folder doc. No doc (or no folder) means mandatory.
export function folderTypeOf(folders, name) {
    return name !== NO_FOLDER && folders?.get?.(name)?.type === 'complementary' ? 'complementary' : 'mandatory';
}

export const folderUnitId = (name) => `folder:${name}`;

/**
 * The UNITS every page counts and draws: one per habit, or one per
 * complementary folder (done on a day when ANY member habit is done).
 * Returns [{ id, kind: 'habit'|'folder', name, folder, members, completedDates }]
 */
export function habitUnits(habits, folders) {
    const units = [];
    const groups = new Map();
    for (const h of habits) {
        const name = folderOf(h);
        if (folderTypeOf(folders, name) !== 'complementary') {
            units.push({ id: h.id, kind: 'habit', name: h.text, folder: name, members: [h], completedDates: h.completedDates || [] });
            continue;
        }
        let u = groups.get(name);
        if (!u) {
            u = { id: folderUnitId(name), kind: 'folder', name, folder: name, members: [], completedDates: [] };
            groups.set(name, u);
            units.push(u);
        }
        u.members.push(h);
    }
    for (const u of groups.values()) {
        u.completedDates = [...new Set(u.members.flatMap((m) => m.completedDates || []))].sort();
    }
    return units;
}

export const unitDoneOn = (unit, dayKey) => unit.completedDates.includes(dayKey);

// habit id -> id of the unit that represents it (itself, or its complementary folder).
export function unitIdByHabit(units) {
    const map = new Map();
    units.forEach((u) => u.members.forEach((h) => map.set(h.id, u.id)));
    return map;
}
