import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { localDayKey, normalizeAct } from './resistance';

// The ONE place a resisted craving is written. Every craving button calls this.
// Writes a `cravings` doc plus a category-N "craving" resistance entry, the same
// shape the Resistance page has always read. `habit` (optional) ties the tap to
// a negative habit by id only; the habit's name stays in `habits`.
// Fire-and-forget: acknowledgement must not wait on the network.
export function logCraving(uid, habit = null) {
    const dayKey = localDayKey();
    const habitId = habit?.id ?? null;
    addDoc(collection(db, 'cravings'), {
        userId: uid, createdAt: serverTimestamp(), dayKey, habitId,
    }).catch(console.error);
    addDoc(collection(db, 'resistanceEntries'), {
        userId: uid, cat: 'N', label: 'craving', act: normalizeAct('craving'),
        mag: null, newContext: false, dayKey, habitId, createdAt: serverTimestamp(),
    }).catch(console.error);
}
