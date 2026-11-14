import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { HabitsContext, FoldersContext } from '../lib/habitsContext';

const NO_FOLDERS = new Map();

// The single live subscriptions to the signed-in user's habits and folders.
// They stay up across page changes, so switching tabs never re-attaches them.
export default function HabitsProvider({ user, children }) {
    const [habitState, setHabitState] = useState({ uid: null, list: [] });
    const [folderState, setFolderState] = useState({ uid: null, map: NO_FOLDERS });
    const uid = user?.uid ?? null;

    useEffect(() => {
        if (!uid) return;
        const mine = (name) => query(collection(db, name), where('userId', '==', uid));
        const unsubH = onSnapshot(
            mine('habits'),
            (snap) => setHabitState({ uid, list: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }),
            console.error,
        );
        const unsubF = onSnapshot(
            mine('habitFolders'),
            (snap) => setFolderState({ uid, map: new Map(snap.docs.map((d) => [d.data().name, { id: d.id, ...d.data() }])) }),
            console.error,
        );
        return () => { unsubH(); unsubF(); };
    }, [uid]);

    const habits = habitState.uid === uid ? habitState.list : [];
    const folders = folderState.uid === uid ? folderState.map : NO_FOLDERS;
    return (
        <HabitsContext.Provider value={habits}>
            <FoldersContext.Provider value={folders}>{children}</FoldersContext.Provider>
        </HabitsContext.Provider>
    );
}
