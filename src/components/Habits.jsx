import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import HabitCalendar from './HabitCalendar';

export default function Habits({ user }) {
    const [habits, setHabits] = useState([]);
    const [newHabit, setNewHabit] = useState('');
    const [newCategory, setNewCategory] = useState('');

    useEffect(() => {
        if (!user) return;

        const q = query(collection(db, 'habits'), where('userId', '==', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const habitsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHabits(habitsData);
        });

        return unsubscribe;
    }, [user]);

    const addHabit = async (e) => {
        e.preventDefault();
        if (!newHabit.trim()) return;

        const category = newCategory.trim() || 'Uncategorized';

        // Check for duplicates
        const isDuplicate = habits.some(h =>
            h.text.toLowerCase() === newHabit.trim().toLowerCase() &&
            (h.category || 'Uncategorized') === category
        );

        if (isDuplicate) {
            alert(`Habit "${newHabit}" already exists in ${category}!`);
            return;
        }

        await addDoc(collection(db, 'habits'), {
            text: newHabit.trim(),
            category: category,
            userId: user.uid,
            createdAt: new Date(),
            completedDates: []
        });
        setNewHabit('');
    };

    const toggleHabit = async (habit, dateStr) => {
        // If no date provided, default to today (legacy behavior)
        const targetDate = dateStr || new Date().toISOString().split('T')[0];

        const isCompleted = habit.completedDates?.includes(targetDate);
        const habitRef = doc(db, 'habits', habit.id);

        if (isCompleted) {
            await updateDoc(habitRef, {
                completedDates: arrayRemove(targetDate)
            });
        } else {
            await updateDoc(habitRef, {
                completedDates: arrayUnion(targetDate)
            });
        }
    };

    const deleteHabit = async (id) => {
        await deleteDoc(doc(db, 'habits', id));
    };

    const getMonthlyStats = (completedDates) => {
        if (!completedDates) return 0;
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        return completedDates.filter(d => d.startsWith(currentMonth)).length;
    };

    // Group habits by category
    const groupedHabits = habits.reduce((acc, habit) => {
        const cat = habit.category || 'Uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(habit);
        return acc;
    }, {});

    const sortedCategories = Object.keys(groupedHabits).sort();
    const today = new Date().toISOString().split('T')[0];

    // existing categories for suggestions
    const existingCategories = [...new Set(habits.map(h => h.category || 'Uncategorized'))].sort();

    return (
        <div className="container" style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '2rem' }}>
            <h2 style={{ marginBottom: '2rem' }}>Your Habits</h2>

            <form onSubmit={addHabit} style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="text"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="Folder (e.g. Health)"
                        list="category-suggestions"
                        style={{
                            width: '40%',
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            background: 'var(--color-surface)',
                            color: 'white',
                            fontSize: '1rem'
                        }}
                    />
                    <datalist id="category-suggestions">
                        {existingCategories.map(cat => <option key={cat} value={cat} />)}
                    </datalist>

                    <input
                        type="text"
                        value={newHabit}
                        onChange={(e) => setNewHabit(e.target.value)}
                        placeholder="New habit..."
                        style={{
                            flex: 1,
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            background: 'var(--color-surface)',
                            color: 'white',
                            fontSize: '1rem'
                        }}
                    />
                </div>
                <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>Add Habit</button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {sortedCategories.map(category => (
                    <div key={category} className="animate-fade-in">
                        <h3 style={{ marginBottom: '1rem', color: 'var(--color-secondary)', opacity: 0.9, fontSize: '1.2rem' }}>
                            📂 {category}
                        </h3>
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {groupedHabits[category].map(habit => {
                                const isCompletedToday = habit.completedDates?.includes(today);
                                const monthlyCount = getMonthlyStats(habit.completedDates);

                                return (
                                    <div key={habit.id} className="card" style={{ transition: 'var(--transition)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <button
                                                    onClick={() => toggleHabit(habit, today)}
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: '50%',
                                                        border: isCompletedToday ? 'none' : '2px solid var(--color-text-dim)',
                                                        background: isCompletedToday ? 'var(--color-secondary)' : 'transparent',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'white',
                                                        transition: 'var(--transition)'
                                                    }}
                                                    title="Mark today"
                                                >
                                                    {isCompletedToday && '✓'}
                                                </button>
                                                <div>
                                                    <span style={{
                                                        fontSize: '1.2rem',
                                                        display: 'block',
                                                        textDecoration: isCompletedToday ? 'line-through' : 'none',
                                                        color: isCompletedToday ? 'var(--color-text-dim)' : 'var(--color-text)'
                                                    }}>
                                                        {habit.text}
                                                    </span>
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                                                        {monthlyCount} times this month
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => deleteHabit(habit.id)}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: 'var(--color-text-dim)',
                                                    cursor: 'pointer',
                                                    opacity: 0.5
                                                }}
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        {/* Calendar View */}
                                        <HabitCalendar
                                            completedDates={habit.completedDates || []}
                                            onToggleDate={(date) => toggleHabit(habit, date)}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {habits.length === 0 && (
                    <p style={{ textAlign: 'center', color: 'var(--color-text-dim)', fontStyle: 'italic' }}>
                        No habits yet. Start tracking your vibe!
                    </p>
                )}
            </div>
        </div>
    );
}
