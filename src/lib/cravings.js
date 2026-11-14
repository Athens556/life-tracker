import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { localDayKey, normalizeAct } from './resistance';
import { habitActLabel } from './habitActs';

// The ONE place resistance taps are written. Every button calls into this file.
// Fire-and-forget: acknowledgement must not wait on the network.

function writeEntry(uid, cat, label, habitId) {
    addDoc(collection(db, 'resistanceEntries'), {
        userId: uid, cat, label, act: normalizeAct(label), mag: null, newContext: false,
        dayKey: localDayKey(), habitId, createdAt: serverTimestamp(),
    }).catch(console.error);
}

function writeCraving(uid, habitId) {
    addDoc(collection(db, 'cravings'), {
        userId: uid, createdAt: serverTimestamp(), dayKey: localDayKey(), habitId,
    }).catch(console.error);
}

// A resistance act tied to a habit (any category). It scores as its own act in
// the Resistance Index, e.g. "Diet craving" or "Diet: pushed past the no".
// Category N also counts as a craving for the hour-of-day histogram.
export function logHabitResistance(uid, cat, habit) {
    if (cat === 'N') writeCraving(uid, habit.id);
    writeEntry(uid, cat, habitActLabel(cat, habit.text), habit.id);
}

// A craving not tied to any habit: the generic "craving" act, unchanged.
export function logCraving(uid) {
    writeCraving(uid, null);
    writeEntry(uid, 'N', 'craving', null);
}
