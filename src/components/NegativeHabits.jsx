import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { localDayKey } from '../lib/resistance';
import { logCraving } from '../lib/cravings';
import { useHabits } from '../lib/habitsContext';

// Craving counter built into every negative habit. A view over `habits`
// (goalType 'negative') and today's `cravings`; taps go through logCraving,
// so the Resistance Index sees them exactly as before.
export default function NegativeHabits({ user }) {
    const habits = useHabits().filter((h) => h.goalType === 'negative');
    const [counts, setCounts] = useState({});
    const [pulseId, setPulseId] = useState(null);

    useEffect(() => {
        if (!user) return;
        const qC = query(collection(db, 'cravings'), where('userId', '==', user.uid), where('dayKey', '==', localDayKey()));
        const unsubC = onSnapshot(qC, (snap) => {
            const next = {};
            snap.docs.forEach((d) => {
                const id = d.data().habitId;
                if (id) next[id] = (next[id] || 0) + 1;
            });
            setCounts(next);
        });
        return unsubC;
    }, [user]);

    const tap = (habit) => {
        setPulseId(habit.id);
        setTimeout(() => setPulseId(null), 350);
        logCraving(user.uid, habit);
    };

    const cell = { padding: '0.6rem 0', borderTop: '1px solid rgba(255,255,255,0.06)' };
    const head = { textAlign: 'left', fontWeight: 500, fontSize: '0.8rem', color: 'var(--color-text-dim)', paddingBottom: '0.5rem' };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto 2rem', padding: '0 1.5rem' }}>
            <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--color-text-dim)', marginBottom: '0.75rem' }}>Cravings resisted</h3>
                {habits.length === 0 ? (
                    <p style={{ color: 'var(--color-text-dim)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                        No negative habits yet. Add a habit with the type "Negative" and its craving counter appears here.
                    </p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={head}>Habit to avoid</th>
                                <th style={{ ...head, textAlign: 'right', paddingRight: '1rem' }}>Today</th>
                                <th style={head}><span style={{ position: 'absolute', left: '-9999px' }}>Log</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...habits].sort((a, b) => a.text.localeCompare(b.text)).map((h) => (
                                <tr key={h.id}>
                                    <td style={cell}>{h.text}</td>
                                    <td style={{ ...cell, textAlign: 'right', paddingRight: '1rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                        {counts[h.id] || 0}
                                    </td>
                                    <td style={{ ...cell, textAlign: 'right', width: '1%', whiteSpace: 'nowrap' }}>
                                        <button type="button" className="btn btn-primary" onClick={() => tap(h)}
                                            style={{
                                                padding: '0.5rem 1rem', fontSize: '0.9rem',
                                                transform: pulseId === h.id ? 'scale(1.06)' : 'scale(1)',
                                                transition: 'transform 0.15s ease',
                                            }}>
                                            Craving resisted
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
