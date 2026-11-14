import { collection, doc, getDocsFromServer, query, where, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ROOTS, ROLE_LABELS } from './cascade';

// Bump when the type of a default in ROOTS changes; existing users are upgraded once.
export const DEFAULTS_VERSION = 2;

// Seeds the default foundation habits once per user. They are ordinary docs in
// `habits`; the flag in `userFlags` means a deleted default is not re-created.
// On a version bump, defaults that still exist get the new type and keep their history.
export async function ensureDefaultHabits(uid) {
    const mine = (name) => query(collection(db, name), where('userId', '==', uid));
    const flags = await getDocsFromServer(mine('userFlags'));
    const flag = flags.docs.map((d) => d.data()).find((d) => d.defaultHabitsSeeded);
    const version = flag ? (flag.defaultHabitsVersion ?? 1) : 0;
    if (version >= DEFAULTS_VERSION) return;

    const habits = await getDocsFromServer(mine('habits'));
    const byKey = new Map(habits.docs.filter((d) => d.data().systemKey).map((d) => [d.data().systemKey, d]));
    await Promise.all(ROOTS.map((r) => {
        const type = { goalType: r.goalType, target: r.target, unit: r.unit };
        const existing = byKey.get(r.id);
        if (existing) return updateDoc(existing.ref, type);
        if (version > 0) return null; // seeded before and since deleted: leave it deleted
        return setDoc(doc(db, 'habits', `${uid}_default_${r.id}`), {
            userId: uid, text: r.name, category: 'Foundations', systemKey: r.id,
            labels: [ROLE_LABELS.root], perWeek: r.perWeek, helpedBy: [], ...type,
            difficulty: null, timeRequired: null, completedDates: [], logs: {}, createdAt: new Date(),
        });
    }));
    await setDoc(doc(db, 'userFlags', uid), {
        userId: uid, defaultHabitsSeeded: true, defaultHabitsVersion: DEFAULTS_VERSION,
    });
}
