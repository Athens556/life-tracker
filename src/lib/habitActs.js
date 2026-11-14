// Resistance acts that belong to a habit. Pure (no Firebase) so it can be tested.
// The label is a snapshot of the habit's name at the time of logging: a
// resistance entry is an event-log row. `habitId` on the entry is the real link.
export const HABIT_ACTIONS = [
    { cat: 'N', button: 'Craving resisted', label: (name) => `${name} craving` },
    { cat: 'P', button: 'Pushed past the no', label: (name) => `${name}: pushed past the no` },
    { cat: 'C', button: 'Cut the cascade', label: (name) => `${name}: cut the cascade` },
    { cat: 'R', button: 'Came back same day', label: (name) => `${name}: came back same day` },
];

export function habitActLabel(cat, name) {
    const action = HABIT_ACTIONS.find((a) => a.cat === cat);
    if (!action) throw new Error(`Unknown resistance category: ${cat}`);
    return action.label(String(name).trim());
}
