import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { localDayKey, normalizeAct } from '../lib/resistance';

// One tap, zero friction: writes a craving doc plus a category-N "craving"
// entry so it feeds the index. No confirmation, no navigation, no text.
export default function CravingButton({ user, compact = false }) {
    const [todayCount, setTodayCount] = useState(0);
    const [pulse, setPulse] = useState(false);

    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'cravings'),
            where('userId', '==', user.uid),
            where('dayKey', '==', localDayKey())
        );
        const unsubscribe = onSnapshot(q, (snap) => setTodayCount(snap.size));
        return unsubscribe;
    }, [user]);

    const tap = () => {
        setPulse(true);
        setTimeout(() => setPulse(false), 350);
        const dayKey = localDayKey();
        // Fire-and-forget: acknowledgement must not wait on the network.
        addDoc(collection(db, 'cravings'), {
            userId: user.uid,
            createdAt: serverTimestamp(),
            dayKey,
        }).catch(console.error);
        addDoc(collection(db, 'resistanceEntries'), {
            userId: user.uid,
            cat: 'N',
            label: 'craving',
            act: normalizeAct('craving'),
            mag: null,
            newContext: false,
            dayKey,
            createdAt: serverTimestamp(),
        }).catch(console.error);
    };

    return (
        <button
            onClick={tap}
            className="btn"
            style={{
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                color: 'white',
                boxShadow: pulse ? '0 0 40px var(--color-primary-glow)' : 'var(--shadow-glow)',
                transform: pulse ? 'scale(1.06)' : 'scale(1)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                width: compact ? 'auto' : '100%',
                padding: compact ? '0.75rem 1.5rem' : '1.25rem 1.5rem',
                fontSize: compact ? '1rem' : '1.2rem',
                gap: '0.75rem',
            }}
        >
            Craving — resisted
            <span style={{
                background: 'rgba(0,0,0,0.25)',
                borderRadius: 'var(--radius-full)',
                padding: '0.1rem 0.7rem',
                fontVariantNumeric: 'tabular-nums',
            }}>
                {todayCount}
            </span>
        </button>
    );
}
