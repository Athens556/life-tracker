import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Analysis({ user }) {
    const [habits, setHabits] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const q = query(collection(db, 'habits'), where('userId', '==', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const habitsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHabits(habitsData);
            setLoading(false);
        });

        return unsubscribe;
    }, [user]);

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading analysis...</div>;

    // --- Data Processing ---
    const getLast14Days = () => {
        const dates = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }
        return dates;
    };

    const last14Days = getLast14Days();
    const totalGoalsPerDay = last14Days.map(date => {
        let completedCount = 0;
        let totalPossible = habits.length; // Assuming all habits are daily for now

        habits.forEach(habit => {
            if (habit.completedDates?.includes(date)) {
                completedCount++;
            }
        });

        return {
            date: date.slice(5), // MM-DD
            completed: completedCount,
            total: totalPossible
        };
    });

    // --- Logic for Suggestions ---
    // Calc average completion rate over last 14 days
    const totalCompleted = totalGoalsPerDay.reduce((acc, day) => acc + day.completed, 0);
    const totalPossible = totalGoalsPerDay.reduce((acc, day) => acc + day.total, 0);
    const completionRate = totalPossible > 0 ? (totalCompleted / totalPossible) * 100 : 0;

    let suggestionTitle = "";
    let suggestionText = "";
    let suggestionColor = "var(--color-text)";

    if (habits.length === 0) {
        suggestionTitle = "Start Your Journey";
        suggestionText = "Add some habits to start tracking your vibe!";
    } else if (completionRate < 30) {
        suggestionTitle = "You couldn't keep up...";
        suggestionText = "It happens to the best of us. Try reducing your daily goals to build momentum.";
        suggestionColor = "#ff6b6b"; // Soft Red
    } else if (completionRate < 70) {
        suggestionTitle = "Moderate Progress";
        suggestionText = "You're showing up, and that matters. Consistency is key—keep going!";
        suggestionColor = "#feca57"; // Warn/Yellow
    } else {
        suggestionTitle = "Crushing It! 🚀";
        suggestionText = "Your vibe is unstoppable! You're consistently smashing your goals.";
        suggestionColor = "#48dbfb"; // Cyan
    }

    // --- Extra Stats ---
    const totalHabits = habits.length;
    const totalDataPoints = habits.reduce((acc, habit) => acc + (habit.completedDates?.length || 0), 0);

    // Most Followed Habit Logi
    let mostFollowedHabit = "—";
    if (habits.length > 0) {
        const sortedByCompletion = [...habits].sort((a, b) =>
            (b.completedDates?.length || 0) - (a.completedDates?.length || 0)
        );
        if (sortedByCompletion[0].completedDates?.length > 0) {
            mostFollowedHabit = sortedByCompletion[0].text;
        }
    }

    return (
        <div className="container animate-fade-in" style={{ padding: '2rem 1.5rem', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '2rem' }}>Analysis</h2>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{totalHabits}</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-dim)' }}>Total Habits Tracked</div>
                </div>
                <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-secondary)' }}>{totalDataPoints}</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-dim)' }}>Total Data Points</div>
                </div>
                <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {mostFollowedHabit}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-dim)' }}>Most Followed Habit</div>
                </div>
            </div>

            {/* Suggestions Card */}
            <div className="card" style={{ marginBottom: '2rem', borderLeft: `4px solid ${suggestionColor}` }}>
                <h3 style={{ color: suggestionColor, marginBottom: '0.5rem' }}>{suggestionTitle}</h3>
                <p style={{ color: 'var(--color-text-dim)', lineHeight: '1.6' }}>{suggestionText}</p>
                <div style={{ marginTop: '1rem', fontSize: '0.9rem', opacity: 0.8 }}>
                    Completion Rate: <strong>{Math.round(completionRate)}%</strong> (Last 14 Days)
                </div>
            </div>

            {/* Graph */}
            <div className="card" style={{ height: '400px', padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Goals Completed Per Day</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={totalGoalsPerDay}>
                        <CartesianGrid stroke="#eee" strokeDasharray="3 3" strokeOpacity={0.1} />
                        <XAxis
                            dataKey="date"
                            stroke="var(--color-text-dim)"
                            tick={{ fill: 'var(--color-text-dim)', fontSize: 12 }}
                            tickMargin={10}
                        />
                        <YAxis
                            stroke="var(--color-text-dim)"
                            allowDecimals={false}
                            tick={{ fill: 'var(--color-text-dim)', fontSize: 12 }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'var(--color-surface)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: 'white'
                            }}
                            itemStyle={{ color: 'var(--color-primary)' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="completed"
                            stroke="var(--color-primary)"
                            strokeWidth={3}
                            dot={{ fill: 'var(--color-primary)', strokeWidth: 0, r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Calendar View */}
            <div className="card" style={{ padding: '2rem', marginTop: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>📅 Monthly Calendar</h3>
                {(() => {
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = now.getMonth();
                    const firstDay = new Date(year, month, 1).getDay();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();

                    const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

                    const getCompletionForDate = (day) => {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        let count = 0;
                        habits.forEach(habit => {
                            if (habit.completedDates?.includes(dateStr)) {
                                count++;
                            }
                        });
                        return count;
                    };

                    const totalHabits = habits.length;

                    return (
                        <>
                            <div style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                {monthName}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
                                {/* Day headers */}
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                    <div key={day} style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-dim)', padding: '0.5rem' }}>
                                        {day}
                                    </div>
                                ))}

                                {/* Empty cells for offset */}
                                {Array.from({ length: firstDay }, (_, i) => (
                                    <div key={`empty-${i}`} />
                                ))}

                                {/* Calendar days */}
                                {Array.from({ length: daysInMonth }, (_, i) => {
                                    const day = i + 1;
                                    const completedCount = getCompletionForDate(day);
                                    const completionRate = totalHabits > 0 ? completedCount / totalHabits : 0;
                                    const isToday = day === now.getDate();

                                    return (
                                        <div
                                            key={day}
                                            style={{
                                                position: 'relative',
                                                aspectRatio: '1',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: isToday ? 'rgba(72, 219, 251, 0.1)' : 'rgba(255,255,255,0.03)',
                                                borderRadius: 'var(--radius-md)',
                                                border: isToday ? '2px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.1)',
                                                padding: '0.5rem'
                                            }}
                                        >
                                            <div style={{ fontSize: '0.9rem', marginBottom: '0.3rem', fontWeight: isToday ? 'bold' : 'normal' }}>
                                                {day}
                                            </div>
                                            {completedCount > 0 && (
                                                <div
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: '50%',
                                                        background: `conic-gradient(var(--color-primary) ${completionRate * 360}deg, rgba(255,255,255,0.1) 0deg)`,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    <div style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '50%',
                                                        background: 'var(--color-surface)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        {completedCount}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    );
                })()}
            </div>
        </div>
    );
}
