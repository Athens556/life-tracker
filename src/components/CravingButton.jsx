import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { localDayKey } from '../lib/resistance';
import { logCraving } from '../lib/cravings';

// One tap, zero friction: logCraving (lib/cravings.js) writes a craving doc plus
// a category-N "craving" entry so it feeds the index. No confirmation, no navigation, no text.
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
        logCraving(user.uid);
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
