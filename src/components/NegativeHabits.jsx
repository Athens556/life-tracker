import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { CATEGORIES, localDayKey } from '../lib/resistance';
import { HABIT_ACTIONS } from '../lib/habitActs';
import { logHabitResistance } from '../lib/cravings';
import { useHabits } from '../lib/habitsContext';

// Resistance buttons built into every negative habit. A view over `habits`
// (goalType 'negative') and today's `resistanceEntries`; taps go through
// lib/cravings.js. Used on the dashboard and, embedded, on the Resistance page.
export default function NegativeHabits({ user, embedded = false }) {
    const habits = useHabits().filter((h) => h.goalType === 'negative');
    const [todayEntries, setTodayEntries] = useState([]);
    const [pulse, setPulse] = useState(null);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'resistanceEntries'), where('userId', '==', user.uid), where('dayKey', '==', localDayKey()));
        return onSnapshot(q, (snap) => setTodayEntries(snap.docs.map((d) => d.data())), console.error);
    }, [user]);

    const count = (habitId, cat) => todayEntries.filter((e) => e.habitId === habitId && e.cat === cat).length;

    const tap = (habit, cat) => {
        const key = `${habit.id}|${cat}`;
        setPulse(key);
        setTimeout(() => setPulse(null), 350);
        logHabitResistance(user.uid, cat, habit);
    };

    const list = habits.length === 0 ? (
        <p style={{ color: 'var(--color-text-dim)', fontStyle: 'italic', fontSize: '0.9rem' }}>
            No negative habits yet. Add a habit with the type "Negative" and its resistance buttons appear here.
        </p>
    ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[...habits].sort((a, b) => a.text.localeCompare(b.text)).map((h, i) => (
                <div key={h.id} style={{ padding: '0.75rem 0', borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{h.text}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {HABIT_ACTIONS.map(({ cat, button }) => {
                            const n = count(h.id, cat);
                            return (
                                <button key={cat} type="button" onClick={() => tap(h, cat)}
                                    title={`${CATEGORIES[cat].name} · base +${CATEGORIES[cat].base}`}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                                        padding: '0.45rem 0.8rem', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                                        fontFamily: 'inherit', fontSize: '0.85rem', color: 'white',
                                        border: `1px solid ${CATEGORIES[cat].color}88`,
                                        background: n ? `${CATEGORIES[cat].color}33` : 'rgba(255,255,255,0.05)',
                                        transform: pulse === `${h.id}|${cat}` ? 'scale(1.06)' : 'scale(1)',
                                        transition: 'transform 0.15s ease',
                                    }}>
                                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: CATEGORIES[cat].color, flexShrink: 0 }} />
                                    {button}
                                    {n > 0 && <strong style={{ fontVariantNumeric: 'tabular-nums' }}>×{n}</strong>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );

    if (embedded) return list;
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto 2rem', padding: '0 1.5rem' }}>
            <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--color-text-dim)', marginBottom: '0.25rem' }}>Resistance by habit</h3>
                {list}
            </div>
        </div>
    );
}
