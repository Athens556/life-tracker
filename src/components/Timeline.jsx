import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, getDoc, query, where, onSnapshot } from 'firebase/firestore';

export default function Timeline({ user }) {
    const [hasProfile, setHasProfile] = useState(false);
    const [loading, setLoading] = useState(true);
    const [habits, setHabits] = useState([]);

    // Profile form state
    const [sleepStart, setSleepStart] = useState('22:00');
    const [sleepEnd, setSleepEnd] = useState('06:00');
    const [workStart, setWorkStart] = useState('09:00');
    const [workEnd, setWorkEnd] = useState('17:00');
    const [commuteMinutes, setCommuteMinutes] = useState(60);
    const [morningRoutineMinutes, setMorningRoutineMinutes] = useState(30);
    const [miscMinutes, setMiscMinutes] = useState(120);

    // Timeline state
    const [scheduledHabits, setScheduledHabits] = useState([]);
    const [draggedHabit, setDraggedHabit] = useState(null);

    useEffect(() => {
        if (!user) return;

        // Load timeline profile
        const loadProfile = async () => {
            const profileDoc = await getDoc(doc(db, 'timelineProfiles', user.uid));
            if (profileDoc.exists()) {
                const data = profileDoc.data();
                setSleepStart(data.sleepStart);
                setSleepEnd(data.sleepEnd);
                setWorkStart(data.workStart);
                setWorkEnd(data.workEnd);
                setCommuteMinutes(data.commuteMinutes);
                setMorningRoutineMinutes(data.morningRoutineMinutes);
                setMiscMinutes(data.miscMinutes);
                setScheduledHabits(data.scheduledHabits || []);
                setHasProfile(true);
            }
            setLoading(false);
        };

        // Load habits
        const q = query(collection(db, 'habits'), where('userId', '==', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const habitsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHabits(habitsData);
        });

        loadProfile();
        return unsubscribe;
    }, [user]);

    const saveProfile = async () => {
        await setDoc(doc(db, 'timelineProfiles', user.uid), {
            userId: user.uid,
            sleepStart,
            sleepEnd,
            workStart,
            workEnd,
            commuteMinutes,
            morningRoutineMinutes,
            miscMinutes,
            scheduledHabits
        });
        setHasProfile(true);
    };

    // Time conversion helpers
    const timeToMinutes = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const minutesToTime = (mins) => {
        const hours = Math.floor(mins / 60) % 24;
        const minutes = mins % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    // Calculate free time
    const calculateFreeTime = () => {
        const sleepMins = (timeToMinutes(sleepEnd) + 1440 - timeToMinutes(sleepStart)) % 1440;
        const workMins = timeToMinutes(workEnd) - timeToMinutes(workStart);
        const totalOccupied = sleepMins + workMins + commuteMinutes + morningRoutineMinutes + miscMinutes;
        return Math.max(0, 1440 - totalOccupied);
    };

    // Drag and drop handlers
    const handleDragStart = (habit) => {
        setDraggedHabit(habit);
    };

    const handleDrop = (timeString) => {
        if (!draggedHabit) return;

        const duration = draggedHabit.timeRequired ?
            parseInt(draggedHabit.timeRequired.split(' ')[0]) || 15 : 15;

        const newScheduledHabit = {
            habitId: draggedHabit.id,
            habitName: draggedHabit.text,
            startTime: timeString,
            duration
        };

        setScheduledHabits([...scheduledHabits, newScheduledHabit]);
        setDraggedHabit(null);
    };

    const removeScheduledHabit = (index) => {
        setScheduledHabits(scheduledHabits.filter((_, i) => i !== index));
    };

    // Generate timeline blocks
    const getTimelineBlocks = () => {
        const blocks = [];

        // Add sleep block(s) - split if crosses midnight
        const sleepStartMins = timeToMinutes(sleepStart);
        const sleepEndMins = timeToMinutes(sleepEnd);

        if (sleepEndMins < sleepStartMins) {
            // Sleep crosses midnight - split into two blocks
            blocks.push({
                type: 'sleep',
                start: sleepStartMins,
                end: 1440, // Until midnight
                label: 'Sleep'
            });
            blocks.push({
                type: 'sleep',
                start: 0, // From midnight
                end: sleepEndMins,
                label: 'Sleep (cont.)'
            });
        } else {
            // Sleep doesn't cross midnight
            blocks.push({
                type: 'sleep',
                start: sleepStartMins,
                end: sleepEndMins,
                label: 'Sleep'
            });
        }

        // Add work + commute
        const workStartMins = timeToMinutes(workStart) - commuteMinutes / 2;
        const workEndMins = timeToMinutes(workEnd) + commuteMinutes / 2;
        blocks.push({
            type: 'work',
            start: workStartMins,
            end: workEndMins,
            label: 'Work + Commute'
        });

        // Add morning routine
        const morningStart = timeToMinutes(sleepEnd);
        blocks.push({
            type: 'routine',
            start: morningStart,
            end: morningStart + morningRoutineMinutes,
            label: 'Morning Routine'
        });

        // Add scheduled habits
        scheduledHabits.forEach(sh => {
            const start = timeToMinutes(sh.startTime);
            blocks.push({
                type: 'habit',
                start,
                end: start + sh.duration,
                label: sh.habitName,
                habitId: sh.habitId
            });
        });

        return blocks;
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading timeline...</div>;

    if (!hasProfile) {
        return (
            <div className="container animate-fade-in" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
                <h2 style={{ marginBottom: '1.5rem' }}>Setup Your Daily Timeline</h2>
                <div className="card" style={{ padding: '2rem' }}>
                    <form onSubmit={(e) => { e.preventDefault(); saveProfile(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-dim)' }}>
                                🌙 Sleep Schedule
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input type="time" value={sleepStart} onChange={(e) => setSleepStart(e.target.value)}
                                    className="custom-input" style={{ flex: 1 }} />
                                <span>to</span>
                                <input type="time" value={sleepEnd} onChange={(e) => setSleepEnd(e.target.value)}
                                    className="custom-input" style={{ flex: 1 }} />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-dim)' }}>
                                💼 Work Schedule
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)}
                                    className="custom-input" style={{ flex: 1 }} />
                                <span>to</span>
                                <input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)}
                                    className="custom-input" style={{ flex: 1 }} />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-dim)' }}>
                                🚗 Total Commute (minutes)
                            </label>
                            <input type="number" value={commuteMinutes} onChange={(e) => setCommuteMinutes(Number(e.target.value))}
                                className="custom-input" />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-dim)' }}>
                                ☀️ Morning Routine (minutes)
                            </label>
                            <input type="number" value={morningRoutineMinutes} onChange={(e) => setMorningRoutineMinutes(Number(e.target.value))}
                                className="custom-input" />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-text-dim)' }}>
                                ⏱️ Misc Time (minutes)
                            </label>
                            <input type="number" value={miscMinutes} onChange={(e) => setMiscMinutes(Number(e.target.value))}
                                className="custom-input" />
                        </div>

                        <div style={{ padding: '1rem', background: 'rgba(72, 219, 251, 0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(72, 219, 251, 0.3)' }}>
                            <strong style={{ color: '#48dbfb' }}>Available Free Time:</strong> {Math.floor(calculateFreeTime() / 60)}h {calculateFreeTime() % 60}min
                        </div>

                        <button type="submit" className="btn btn-primary">Create Timeline</button>
                    </form>
                </div>
            </div>
        );
    }

    const timelineBlocks = getTimelineBlocks();
    const unscheduledHabits = habits.filter(h => !scheduledHabits.some(sh => sh.habitId === h.id));

    return (
        <div className="container animate-fade-in" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2>Daily Timeline</h2>
                <button onClick={() => setHasProfile(false)} className="btn" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    Edit Schedule
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem' }}>
                {/* Habits Sidebar */}
                <div className="card" style={{ padding: '1.5rem', height: 'fit-content' }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Your Habits</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {unscheduledHabits.map(habit => (
                            <div
                                key={habit.id}
                                draggable
                                onDragStart={() => handleDragStart(habit)}
                                style={{
                                    padding: '0.8rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'grab',
                                    border: '2px dashed rgba(255,255,255,0.2)'
                                }}
                            >
                                <div style={{ fontWeight: 'bold', marginBottom: '0.2rem' }}>{habit.text}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>
                                    {habit.timeRequired || '15 min'}
                                </div>
                            </div>
                        ))}
                        {unscheduledHabits.length === 0 && (
                            <div style={{ color: 'var(--color-text-dim)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>
                                All habits scheduled!
                            </div>
                        )}
                    </div>
                </div>

                {/* Timeline Grid */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>24-Hour Timeline</h3>
                    <div style={{ position: 'relative', height: '1200px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}>
                        {/* Time Slots - 30 minute intervals */}
                        {Array.from({ length: 48 }, (_, i) => {
                            const hour = Math.floor(i / 2);
                            const minute = (i % 2) * 30;
                            const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                            const isFullHour = minute === 0;

                            return (
                                <div
                                    key={i}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => handleDrop(timeString)}
                                    style={{
                                        position: 'absolute',
                                        top: `${(i / 48) * 100}%`,
                                        left: 0,
                                        right: 0,
                                        height: '25px',
                                        borderTop: isFullHour ? '1px solid rgba(255,255,255,0.2)' : '1px dashed rgba(255,255,255,0.05)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '0 0.5rem'
                                    }}
                                >
                                    {isFullHour && (
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', width: '50px' }}>
                                            {timeString}
                                        </span>
                                    )}
                                </div>
                            );
                        })}

                        {/* Timeline Blocks */}
                        {timelineBlocks.map((block, idx) => {
                            const top = (block.start / 1440) * 100;
                            const height = ((block.end - block.start) / 1440) * 100;
                            const colors = {
                                sleep: { bg: 'rgba(72, 61, 139, 0.3)', border: '#9370DB' },
                                work: { bg: 'rgba(255, 140, 0, 0.3)', border: '#FF8C00' },
                                routine: { bg: 'rgba(46, 213, 115, 0.3)', border: '#2ed573' },
                                habit: { bg: 'rgba(72, 219, 251, 0.3)', border: '#48dbfb' }
                            };

                            return (
                                <div
                                    key={idx}
                                    style={{
                                        position: 'absolute',
                                        top: `${top}%`,
                                        left: '60px',
                                        right: '10px',
                                        height: `${height}%`,
                                        background: colors[block.type].bg,
                                        border: `2px solid ${colors[block.type].border}`,
                                        borderRadius: 'var(--radius-sm)',
                                        padding: '0.5rem',
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <span>{block.label}</span>
                                    {block.type === 'habit' && (
                                        <button
                                            onClick={() => removeScheduledHabit(scheduledHabits.findIndex(sh => sh.habitId === block.habitId))}
                                            style={{
                                                background: 'rgba(255,255,255,0.2)',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '20px',
                                                height: '20px',
                                                cursor: 'pointer',
                                                color: 'white',
                                                fontSize: '0.8rem'
                                            }}
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <button onClick={saveProfile} className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }}>
                        Save Timeline
                    </button>
                </div>
            </div>
        </div>
    );
}
