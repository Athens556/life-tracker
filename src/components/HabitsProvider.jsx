import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { HabitsContext } from '../lib/habitsContext';

// The single live subscription to the signed-in user's habits. It stays up
// across page changes, so switching tabs never detaches and re-attaches it.
export default function HabitsProvider({ user, children }) {
    const [state, setState] = useState({ uid: null, list: [] });
    const uid = user?.uid ?? null;

    useEffect(() => {
        if (!uid) return;
        const q = query(collection(db, 'habits'), where('userId', '==', uid));
        return onSnapshot(
            q,
            (snap) => setState({ uid, list: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }),
            console.error,
        );
    }, [uid]);

    const habits = state.uid === uid ? state.list : [];
    return <HabitsContext.Provider value={habits}>{children}</HabitsContext.Provider>;
}
