import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import HabitCalendar from './HabitCalendar';
import { analyzeHabits } from '../lib/gemini.js';

export default function Habits({ user }) {
    const [habits, setHabits] = useState([]);
    const [collapsedFolders, setCollapsedFolders] = useState({}); // { "Folder Name": true/false }
    const [aiResponse, setAiResponse] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Form State
    const [newHabit, setNewHabit] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showGoalSuggestions, setShowGoalSuggestions] = useState(false); // New state for goal dropdown
    const [goalType, setGoalType] = useState('simple'); // simple, numeric
    const [target, setTarget] = useState('');
    const [unit, setUnit] = useState('');

    // Logging State (for numeric inputs)
    const [logValues, setLogValues] = useState({}); // { habitId: value }

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
            completedDates: [],
            logs: {}, // Map of date -> value
            goalType,
            target: goalType === 'numeric' ? Number(target) : null,
            unit: goalType === 'numeric' ? unit : null
        });

        // Reset Form
        setNewHabit('');
        setGoalType('simple');
        setTarget('');
        setUnit('');
    };

    const toggleHabit = async (habit, dateStr) => {
        const targetDate = dateStr || new Date().toISOString().split('T')[0];
        const habitRef = doc(db, 'habits', habit.id);

        // Boolean Logic (Simple)
        if (habit.goalType === 'simple' || !habit.goalType) {
            const isCompleted = habit.completedDates?.includes(targetDate);
            if (isCompleted) {
                await updateDoc(habitRef, { completedDates: arrayRemove(targetDate) });
            } else {
                await updateDoc(habitRef, { completedDates: arrayUnion(targetDate) });
            }
        }
    };

    const logNumericValue = async (habit, value) => {
        if (value === '' || isNaN(value)) return;
        const numValue = Number(value);
        const today = new Date().toISOString().split('T')[0];
        const habitRef = doc(db, 'habits', habit.id);

        // Update logs
        // We need to merge with existing logs, but here we just send the update for the specific key
        // Firestore update with dot notation works for nested fields

        // Check completion
        const isCompleted = numValue >= (habit.target || 0);

        // Update Firestore
        // We treat 'completedDates' as the Source of Truth for "Streaks"
        if (isCompleted) {
            await updateDoc(habitRef, {
                [`logs.${today}`]: numValue,
                completedDates: arrayUnion(today)
            });
        } else {
            await updateDoc(habitRef, {
                [`logs.${today}`]: numValue,
                completedDates: arrayRemove(today)
            });
        }

        // Clear local input
        setLogValues(prev => ({ ...prev, [habit.id]: '' }));
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

    const handleAIAnalysis = async () => {
        setIsAnalyzing(true);
        const response = await analyzeHabits(habits, user.displayName || 'Friend');
        setAiResponse(response);
        setIsAnalyzing(false);
        setIsAnalyzing(false);
    };

    const toggleFolder = (category) => {
        setCollapsedFolders(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    return (
        <div className="container" style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2>Your Habits</h2>
                <button
                    onClick={handleAIAnalysis}
                    disabled={isAnalyzing}
                    className="btn btn-primary"
                    style={{ background: 'var(--color-secondary)', opacity: isAnalyzing ? 0.7 : 1 }}
                >
                    {isAnalyzing ? 'Reading Vibes...' : '🔮 Ask Vibe AI'}
                </button>
            </div>

            {aiResponse && (
                <div className="animate-fade-in" style={{
                    padding: '1rem',
                    background: 'linear-gradient(45deg, rgba(100,100,255,0.1), rgba(200,100,255,0.1))',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '2rem',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-secondary)' }}>Vibe AI says:</strong>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{aiResponse}</div>
                </div>
            )}

            {/* Create Habit Form */}
            <div className="card" style={{ position: 'relative', zIndex: 20, marginBottom: '2rem', padding: '1.5rem', background: 'rgba(255, 255, 255, 0.05)' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--color-text-dim)' }}>Create New Habit</h3>
                <form onSubmit={addHabit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>

                        {/* Folder Selection Logic */}
                        {/* Folder Selection Logic */}
                        <div style={{ flex: 1, minWidth: '150px', position: 'relative' }}>
                            <input
                                type="text"
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                                onFocus={() => setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} // Delay to allow click
                                placeholder="Folder (e.g. Health)"
                                className="custom-input"
                            />
                            {showSuggestions && existingCategories.length > 0 && (
                                <div className="custom-dropdown-menu">
                                    {existingCategories
                                        .filter(cat => cat.toLowerCase().includes(newCategory.toLowerCase()))
                                        .map(cat => (
                                            <div
                                                key={cat}
                                                onMouseDown={() => {
                                                    setNewCategory(cat);
                                                    setShowSuggestions(false);
                                                }}
                                                className="custom-dropdown-item"
                                            >
                                                {cat}
                                            </div>
                                        ))
                                    }
                                </div>
                            )}
                        </div>

                        <input
                            type="text"
                            value={newHabit}
                            onChange={(e) => setNewHabit(e.target.value)}
                            placeholder="Habit Name (e.g. Drink Water)"
                            required
                            style={{ flex: 2, minWidth: '200px', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-bg)', color: 'white' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>

                        {/* Goal Type Custom Dropdown */}
                        <div
                            style={{ position: 'relative', width: '260px' }}
                            tabIndex={0}
                            onBlur={() => setTimeout(() => setShowGoalSuggestions(false), 200)}
                        >
                            <div
                                className="custom-input"
                                onClick={() => setShowGoalSuggestions(!showGoalSuggestions)}
                                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <span>{goalType === 'simple' ? '✅ Simple (Done/Not Done)' : '🔢 Numeric (e.g. Steps)'}</span>
                                <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>▼</span>
                            </div>

                            {showGoalSuggestions && (
                                <div className="custom-dropdown-menu">
                                    <div
                                        className="custom-dropdown-item"
                                        onClick={() => { setGoalType('simple'); setShowGoalSuggestions(false); }}
                                    >
                                        ✅ Simple (Done/Not Done)
                                    </div>
                                    <div
                                        className="custom-dropdown-item"
                                        onClick={() => { setGoalType('numeric'); setShowGoalSuggestions(false); }}
                                    >
                                        🔢 Numeric (e.g. 10000 Steps)
                                    </div>
                                </div>
                            )}
                        </div>

                        {goalType === 'numeric' && (
                            <>
                                <input
                                    type="number"
                                    value={target}
                                    onChange={(e) => setTarget(e.target.value)}
                                    placeholder="Target (e.g. 10000)"
                                    required
                                    style={{ width: '120px', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-bg)', color: 'white' }}
                                />
                                <input
                                    type="text"
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value)}
                                    placeholder="Unit (e.g. steps)"
                                    required
                                    style={{ width: '100px', padding: '0.8rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-bg)', color: 'white' }}
                                />
                            </>
                        )}

                        <button type="submit" className="btn btn-primary" style={{ marginLeft: 'auto' }}>Add Habit</button>
                    </div>
                </form>
            </div>

            {/* Habit List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {sortedCategories.map(category => (
                    <div key={category} className="animate-fade-in">
                        <div
                            onClick={() => toggleFolder(category)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                marginBottom: '1rem',
                                userSelect: 'none'
                            }}
                        >
                            <span style={{
                                marginRight: '0.5rem',
                                transform: collapsedFolders[category] ? 'rotate(-90deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s ease'
                            }}>
                                ▼
                            </span>
                            <h3 style={{ margin: 0, color: 'var(--color-secondary)', opacity: 0.9, fontSize: '1.2rem' }}>
                                📂 {category}
                            </h3>
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-dim)' }}>
                                ({groupedHabits[category].length})
                            </span>
                        </div>

                        {!collapsedFolders[category] && (
                            <div style={{ display: 'grid', gap: '1rem', paddingLeft: '1rem' }}>
                                {groupedHabits[category].map(habit => {
                                    const isCompletedToday = habit.completedDates?.includes(today);
                                    const monthlyCount = getMonthlyStats(habit.completedDates);
                                    const isNumeric = habit.goalType === 'numeric';
                                    const currentLog = habit.logs?.[today] || 0;

                                    return (
                                        <div key={habit.id} className="card" style={{ transition: 'var(--transition)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        {/* Checkbox / Completion Indicator */}
                                                        {!isNumeric ? (
                                                            <button
                                                                onClick={() => toggleHabit(habit, today)}
                                                                style={{
                                                                    width: '32px', height: '32px', borderRadius: '50%',
                                                                    border: isCompletedToday ? 'none' : '2px solid var(--color-text-dim)',
                                                                    background: isCompletedToday ? 'var(--color-secondary)' : 'transparent',
                                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    color: 'white', transition: 'var(--transition)', flexShrink: 0
                                                                }}
                                                                title="Mark today"
                                                            >
                                                                {isCompletedToday && '✓'}
                                                            </button>
                                                        ) : (
                                                            <div style={{
                                                                width: '32px', height: '32px', borderRadius: '50%',
                                                                background: isCompletedToday ? 'var(--color-secondary)' : 'rgba(255,255,255,0.1)',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: '0.8rem', fontWeight: 'bold'
                                                            }}>
                                                                {isCompletedToday ? '✓' : '#'}
                                                            </div>
                                                        )}

                                                        <div>
                                                            <span style={{
                                                                fontSize: '1.2rem', display: 'block',
                                                                textDecoration: isCompletedToday ? 'line-through' : 'none',
                                                                color: isCompletedToday ? 'var(--color-text-dim)' : 'var(--color-text)'
                                                            }}>
                                                                {habit.text}
                                                            </span>
                                                            <span style={{ fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                                                                {monthlyCount} days this month
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Numeric Input Area */}
                                                    {isNumeric && (
                                                        <div style={{ marginLeft: '3rem', marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-dim)' }}>
                                                                Today: <strong style={{ color: 'white' }}>{currentLog}</strong> / {habit.target} {habit.unit}
                                                            </div>
                                                            <div style={{ height: '6px', flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', maxWidth: '100px' }}>
                                                                <div style={{
                                                                    height: '100%',
                                                                    width: `${Math.min((currentLog / (habit.target || 1)) * 100, 100)}%`,
                                                                    background: isCompletedToday ? 'var(--color-secondary)' : 'var(--color-primary)'
                                                                }} />
                                                            </div>
                                                            <input
                                                                type="number"
                                                                placeholder="Add..."
                                                                value={logValues[habit.id] || ''}
                                                                onChange={(e) => setLogValues({ ...logValues, [habit.id]: e.target.value })}
                                                                onBlur={(e) => logNumericValue(habit, e.target.value)}
                                                                onKeyDown={(e) => e.key === 'Enter' && logNumericValue(habit, e.currentTarget.value)}
                                                                style={{
                                                                    width: '80px', padding: '0.4rem', borderRadius: '4px',
                                                                    border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white'
                                                                }}
                                                            />
                                                        </div>
                                                    )}

                                                </div>
                                                <button onClick={() => deleteHabit(habit.id)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-dim)', cursor: 'pointer', opacity: 0.5 }}>✕</button>
                                            </div>

                                            <HabitCalendar completedDates={habit.completedDates || []} onToggleDate={(date) => toggleHabit(habit, date)} />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
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
