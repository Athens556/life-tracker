import { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useHabits, useFolders } from '../lib/habitsContext';
import { habitUnits, unitIdByHabit } from '../lib/folders';
import { roleOf } from '../lib/cascade';
import {
    timeToMinutes, unitMinutes, clampDuration, daySegments, normaliseSchedule, freeMinutes,
} from '../lib/timeline';

// A day plan built from UNITS (a habit, or a complementary folder as one item).
// Sleep is not a separate setting: it is the Sleep habit, placed like any other.
// Stored in timelineProfiles/{uid}: work settings + scheduledHabits [{ unitId, startTime, duration }].

const COLORS = {
    sleep: { bg: 'rgba(72, 61, 139, 0.3)', border: '#9370DB' },
    work: { bg: 'rgba(255, 140, 0, 0.3)', border: '#FF8C00' },
    routine: { bg: 'rgba(46, 213, 115, 0.3)', border: '#2ed573' },
    unit: { bg: 'rgba(72, 219, 251, 0.3)', border: '#48dbfb' },
};
const DEFAULT_PROFILE = { workStart: '09:00', workEnd: '17:00', commuteMinutes: 60, morningRoutineMinutes: 30, miscMinutes: 120 };
const fmt = (mins) => `${Math.floor(mins / 60)}h ${mins % 60}min`;
const dim = { color: 'var(--color-text-dim)' };
const small = { padding: '0.4rem 0.5rem', fontSize: '0.85rem', width: 'auto' };

export default function Timeline({ user }) {
    const habits = useHabits();
    const folders = useFolders();
    const [loading, setLoading] = useState(true);
    const [hasProfile, setHasProfile] = useState(false);
    const [profile, setProfile] = useState(DEFAULT_PROFILE);
    const [stored, setStored] = useState([]);             // schedule entries as loaded or edited
    const [legacySleep, setLegacySleep] = useState(null); // sleep times from the old setup form
    const [dragged, setDragged] = useState(null);
    const [saved, setSaved] = useState(true);

    useEffect(() => {
        if (!user) return;
        let alive = true;
        getDoc(doc(db, 'timelineProfiles', user.uid)).then((snap) => {
            if (!alive) return;
            if (snap.exists()) {
                const d = snap.data();
                setProfile(Object.fromEntries(Object.keys(DEFAULT_PROFILE).map((k) => [k, d[k] ?? DEFAULT_PROFILE[k]])));
                setStored(d.scheduledHabits || []);
                // An old-format profile is shown converted; it is only rewritten on Save.
                if (d.sleepStart || (d.scheduledHabits || []).some((e) => !e.unitId)) setSaved(false);
                if (d.sleepStart && d.sleepEnd) {
                    const duration = (timeToMinutes(d.sleepEnd) - timeToMinutes(d.sleepStart) + 1440) % 1440;
                    setLegacySleep({ startTime: d.sleepStart, duration: duration || 480 });
                }
                setHasProfile(true);
            }
            setLoading(false);
        }).catch((err) => {
            console.error(err);
            if (alive) setLoading(false);
        });
        return () => { alive = false; };
    }, [user]);

    const units = useMemo(() => habitUnits(habits, folders), [habits, folders]);
    const byId = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
    const sleepUnit = units.find((u) => u.members.some((m) => m.systemKey === 'sleep'));
    const sleepId = sleepUnit?.id;

    // The schedule in the current format, whatever shape it was stored in.
    const schedule = useMemo(() => {
        let list = normaliseSchedule(stored, unitIdByHabit(units)).filter((e) => byId.has(e.unitId));
        list = list.map((e) => (e.legacy ? { ...e, duration: unitMinutes(byId.get(e.unitId)) } : e));
        if (legacySleep && sleepId && !list.some((e) => e.unitId === sleepId)) {
            list = [...list, { unitId: sleepId, ...legacySleep }];
        }
        return list.map(({ unitId, startTime, duration }) => ({ unitId, startTime, duration }));
    }, [stored, units, byId, legacySleep, sleepId]);

    const commit = (next) => { setStored(next); setLegacySleep(null); setSaved(false); };
    const place = (unit, startTime) => commit([
        ...schedule.filter((e) => e.unitId !== unit.id),
        { unitId: unit.id, startTime, duration: unitMinutes(unit) },
    ]);
    const update = (unitId, data) => commit(schedule.map((e) => (e.unitId === unitId ? { ...e, ...data } : e)));
    const remove = (unitId) => commit(schedule.filter((e) => e.unitId !== unitId));
    const setField = (key, value) => { setProfile((p) => ({ ...p, [key]: value })); setSaved(false); };

    const save = async () => {
        await setDoc(doc(db, 'timelineProfiles', user.uid), { userId: user.uid, ...profile, scheduledHabits: schedule });
        setStored(schedule);
        setLegacySleep(null);
        setHasProfile(true);
        setSaved(true);
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading timeline...</div>;

    const free = freeMinutes(profile, schedule);

    if (!hasProfile) {
        const numberField = (label, key) => (
            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', ...dim }}>{label}</label>
                <input type="number" min="0" value={profile[key]} className="custom-input"
                    onChange={(e) => setField(key, Math.max(0, Number(e.target.value) || 0))} />
            </div>
        );
        return (
            <div className="container animate-fade-in" style={{ padding: '2rem 1.5rem', maxWidth: '600px', margin: '0 auto' }}>
                <h2 style={{ marginBottom: '1.5rem' }}>Setup Your Daily Timeline</h2>
                <div className="card">
                    <form onSubmit={(e) => { e.preventDefault(); save(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', ...dim }}>💼 Work Schedule</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input type="time" value={profile.workStart} onChange={(e) => setField('workStart', e.target.value)} className="custom-input" style={{ flex: 1 }} />
                                <span>to</span>
                                <input type="time" value={profile.workEnd} onChange={(e) => setField('workEnd', e.target.value)} className="custom-input" style={{ flex: 1 }} />
                            </div>
                        </div>
                        {numberField('🚗 Total Commute (minutes)', 'commuteMinutes')}
                        {numberField('☀️ Morning Routine (minutes)', 'morningRoutineMinutes')}
                        {numberField('⏱️ Misc Time (minutes)', 'miscMinutes')}
                        <p style={{ ...dim, fontSize: '0.85rem' }}>
                            Sleep is not set here. It is your Sleep habit: place it on the timeline like any other habit.
                        </p>
                        <div style={{ padding: '1rem', background: 'rgba(72, 219, 251, 0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(72, 219, 251, 0.3)' }}>
                            <strong style={{ color: '#48dbfb' }}>Unplanned time:</strong> {fmt(free)}
                        </div>
                        <button type="submit" className="btn btn-primary">Save Schedule</button>
                    </form>
                </div>
            </div>
        );
    }

    // Fixed blocks, then one block per scheduled unit (split when it passes midnight).
    const blocks = [];
    const add = (type, label, start, duration, unitId) => daySegments(start, duration).forEach((seg, i) =>
        blocks.push({ ...seg, type, label: i ? `${label} (cont.)` : label, unitId, key: `${type}|${unitId || label}|${i}` }));
    const workDuration = (timeToMinutes(profile.workEnd) - timeToMinutes(profile.workStart) + 1440) % 1440;
    const workStart = timeToMinutes(profile.workStart) - profile.commuteMinutes / 2;
    add('work', 'Work + Commute', workStart, workDuration + profile.commuteMinutes);
    const sleepEntry = schedule.find((e) => e.unitId === sleepId);
    if (profile.morningRoutineMinutes > 0) {
        const routineStart = sleepEntry
            ? timeToMinutes(sleepEntry.startTime) + sleepEntry.duration
            : workStart - profile.morningRoutineMinutes;
        add('routine', 'Morning Routine', routineStart, profile.morningRoutineMinutes);
    }
    schedule.forEach((e) => add(e.unitId === sleepId ? 'sleep' : 'unit', byId.get(e.unitId).name, timeToMinutes(e.startTime), e.duration, e.unitId));

    // Things to avoid and consequences are not activities, so they are not offered for placing.
    const schedulable = (u) => !u.members.every((m) => m.goalType === 'negative' || roleOf(m.labels) === 'outcome');
    const unplaced = units.filter((u) => schedulable(u) && !schedule.some((e) => e.unitId === u.id));
    const membersNote = (u) => (u.kind === 'folder' ? `any one of ${u.members.map((m) => m.text).join(', ')}` : null);

    return (
        <div className="container animate-fade-in" style={{ padding: '2rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <div>
                    <h2>Daily Timeline</h2>
                    <div style={{ ...dim, fontSize: '0.9rem', marginTop: '0.25rem' }}>Unplanned time: <strong style={{ color: 'white' }}>{fmt(free)}</strong></div>
                </div>
                <button onClick={() => setHasProfile(false)} className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                    Edit Schedule
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="card">
                        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>To place</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {unplaced.map((u) => (
                                <form key={u.id} draggable onDragStart={() => setDragged(u)}
                                    onSubmit={(e) => { e.preventDefault(); place(u, e.currentTarget.elements.at.value); }}
                                    style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', cursor: 'grab', border: '2px dashed rgba(255,255,255,0.2)' }}>
                                    <div style={{ fontWeight: 'bold' }}>{u.name}</div>
                                    <div style={{ fontSize: '0.8rem', ...dim, marginBottom: '0.5rem' }}>
                                        {fmt(unitMinutes(u))}{membersNote(u) ? ` · ${membersNote(u)}` : ''}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <input type="time" name="at" defaultValue={u.id === sleepId ? '23:00' : '07:00'} className="custom-input" style={small} aria-label={`Start time for ${u.name}`} />
                                        <button type="submit" className="btn" style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem', background: 'rgba(255,255,255,0.1)', color: 'white' }}>Place</button>
                                    </div>
                                </form>
                            ))}
                            {unplaced.length === 0 && (
                                <div style={{ ...dim, fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>Everything is placed.</div>
                            )}
                        </div>
                    </div>

                    <div className="card">
                        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Scheduled</h3>
                        {schedule.length === 0 && <div style={{ ...dim, fontSize: '0.9rem' }}>Nothing yet. Drag an item onto the timeline, or use Place.</div>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {[...schedule].sort((a, b) => a.startTime.localeCompare(b.startTime)).map((e) => (
                                <div key={e.unitId}>
                                    <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>{byId.get(e.unitId).name}</div>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <input type="time" value={e.startTime} className="custom-input" style={small} aria-label="Start time"
                                            onChange={(ev) => ev.target.value && update(e.unitId, { startTime: ev.target.value })} />
                                        <input type="number" min="5" max="1440" step="5" value={e.duration} className="custom-input" style={{ ...small, width: '5.5rem' }} aria-label="Length in minutes"
                                            onChange={(ev) => update(e.unitId, { duration: clampDuration(ev.target.value) })} />
                                        <span style={{ ...dim, fontSize: '0.8rem' }}>min</span>
                                        <button type="button" onClick={() => remove(e.unitId)} aria-label={`Remove ${byId.get(e.unitId).name}`}
                                            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--color-text-dim)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="card">
                    <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>24-Hour Timeline</h3>
                    <div style={{ position: 'relative', height: '1200px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}>
                        {Array.from({ length: 48 }, (_, i) => {
                            const timeString = `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`;
                            return (
                                <div key={i} onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => { if (dragged) place(dragged, timeString); setDragged(null); }}
                                    style={{
                                        position: 'absolute', top: `${(i / 48) * 100}%`, left: 0, right: 0, height: '25px',
                                        borderTop: i % 2 ? '1px dashed rgba(255,255,255,0.05)' : '1px solid rgba(255,255,255,0.2)',
                                        display: 'flex', alignItems: 'center', padding: '0 0.5rem',
                                    }}>
                                    {i % 2 === 0 && <span style={{ fontSize: '0.75rem', ...dim, width: '50px' }}>{timeString}</span>}
                                </div>
                            );
                        })}
                        {blocks.map((b) => (
                            <div key={b.key} title={b.label}
                                style={{
                                    position: 'absolute', top: `${(b.start / 1440) * 100}%`, height: `${((b.end - b.start) / 1440) * 100}%`,
                                    left: '60px', right: '10px', overflow: 'hidden', pointerEvents: 'none',
                                    background: COLORS[b.type].bg, border: `2px solid ${COLORS[b.type].border}`, borderRadius: 'var(--radius-sm)',
                                    padding: '0 0.5rem', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center',
                                }}>
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.label}</span>
                            </div>
                        ))}
                    </div>
                    <button onClick={save} className="btn btn-primary" style={{ marginTop: '1rem', width: '100%' }}>
                        {saved ? 'Saved ✓' : 'Save Timeline'}
                    </button>
                </div>
            </div>
        </div>
    );
}
