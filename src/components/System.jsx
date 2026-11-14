import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, doc, query, where, onSnapshot, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { DEFAULT_FADE_DAYS, clampFadeDays, localDayKey } from '../lib/resistance';
import {
    ROOTS, KINDS, ROUTINE_AT, computeSystem, layoutSystem, canHelp, clampPerWeek, lastDays,
    roleOf, labelsForRole,
} from '../lib/cascade';
import CascadeTree from './CascadeTree';
import { useHabits, useFolders } from '../lib/habitsContext';
import { habitUnits, unitIdByHabit } from '../lib/folders';
import { saveFolder } from '../lib/folderStore';

// ONE SOURCE OF TRUTH: this page is a view over the `habits` collection.
// It never stores its own copy of a habit. Role = a tag in habits.labels,
// check-ins = habits.completedDates, links = habits.helpedBy.

const WARN = '#feca57';
const pct = (v) => `${Math.round(v * 100)}%`;
const CADENCES = [7, 6, 5, 4, 3, 2, 1];
const dim = { color: 'var(--color-text-dim)' };
const sectionLabel = { ...dim, fontSize: '0.8rem', marginBottom: '0.5rem' };

function Chip({ active, color, onClick, children }) {
    return (
        <button type="button" onClick={onClick} aria-pressed={active}
            style={{
                padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '0.85rem', color: 'white',
                border: `1px solid ${active ? color : 'rgba(255,255,255,0.15)'}`,
                background: active ? `${color}33` : 'transparent', transition: 'var(--transition)',
            }}>
            {active ? '✓ ' : ''}{children}
        </button>
    );
}

export default function System({ user }) {
    const habits = useHabits();
    const folders = useFolders();
    const [fadeDays, setFadeDays] = useState(DEFAULT_FADE_DAYS);
    const [selectedId, setSelectedId] = useState(null);
    const [width, setWidth] = useState(0);
    const wrapRef = useRef(null);
    const today = localDayKey();

    useEffect(() => {
        if (!user) return;
        // Queries only: the rules deny reading a doc id that does not exist yet.
        const qS = query(collection(db, 'resistanceSettings'), where('userId', '==', user.uid));
        const unsubS = onSnapshot(qS, (snap) => {
            if (snap.docs.length) setFadeDays(clampFadeDays(snap.docs[0].data().fadeDays));
        });
        return unsubS;
    }, [user]);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Nodes are UNITS: a habit, or a complementary folder drawn as one node.
    const nodes = useMemo(() => {
        const units = habitUnits(habits, folders);
        const toUnit = unitIdByHabit(units);
        const link = (ids, self) => [...new Set((ids || []).map((id) => toUnit.get(id) || id))].filter((id) => id !== self);
        return units.map((u) => {
            if (u.kind === 'folder') {
                const roles = new Set(u.members.map((m) => roleOf(m.labels)));
                const f = folders.get(u.name) || {};
                return {
                    id: u.id, name: u.name, kind: roles.size === 1 ? [...roles][0] : 'habit', labels: [],
                    helpedBy: link(f.helpedBy, u.id), days: u.completedDates, perWeek: f.perWeek ?? 7, folder: u.name,
                    lock: `Done when any one of ${u.members.map((m) => m.text).join(', ')} is done. Tick it on the Habits page.`,
                };
            }
            const h = u.members[0];
            const order = ROOTS.findIndex((r) => r.id === h.systemKey);
            return {
                id: h.id, name: h.text, kind: roleOf(h.labels), labels: h.labels || [],
                helpedBy: link(h.helpedBy, h.id), days: u.completedDates, perWeek: h.perWeek ?? 7,
                lock: h.goalType === 'numeric' ? 'Numeric habit: log the number on the Habits page.' : null,
                order: order < 0 ? undefined : order,
            };
        });
    }, [habits, folders]);

    const sys = useMemo(() => computeSystem(nodes, fadeDays, today), [nodes, fadeDays, today]);
    const layout = useMemo(() => (width > 0 && nodes.length ? layoutSystem(sys, width) : null), [sys, width, nodes.length]);
    const selected = selectedId ? sys.get(selectedId) : null;

    // A folder node's links and cadence live on the folder doc; a habit's on the habit.
    const patch = (node, data) => (node.folder
        ? saveFolder(user.uid, node.folder, data)
        : updateDoc(doc(db, 'habits', node.id), data).catch(console.error));
    const toggleDay = (node, dayKey) =>
        patch(node, { completedDates: node.days.includes(dayKey) ? arrayRemove(dayKey) : arrayUnion(dayKey) });
    const toggleHelper = (node, helperId) =>
        patch(node, { helpedBy: node.helpedBy.includes(helperId) ? arrayRemove(helperId) : arrayUnion(helperId) });
    const setRole = (node, role) => {
        const labels = labelsForRole(node.labels, role);
        return patch(node, { labels: labels.length ? labels : null });
    };

    const statusLine = (n) => {
        const weak = n.parents.map((p) => sys.get(p)).filter((p) => p.status === 'slipping' || p.atRisk);
        const risk = weak.length ? ` ${weak.map((p) => p.name).join(', ')} is slipping underneath it.` : '';
        if (n.kind === 'outcome') {
            return (n.parents.length
                ? 'Follows the average strength of the habits behind it.'
                : 'Not linked to any habit yet.') + risk;
        }
        if (n.status === 'not started') return `No check-ins yet.${risk}`;
        if (n.status === 'slipping') {
            return 'Overdue. A missed day only releases half a repeat, so coming back today keeps most of it.';
        }
        if (n.status === 'building') {
            const need = Math.ceil((n.horizon * Math.log(1 / (1 - ROUTINE_AT))) / Math.log(50) - n.c);
            return `About ${Math.max(1, need)} more repeats until this is routine.${risk}`;
        }
        return (n.status === 'locked in' ? 'Locked in.' : 'Routine now.') + risk;
    };

    return (
        <div className="container animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '2rem', paddingBottom: '3rem' }}>
            <h2>System</h2>
            <p style={{ ...dim, fontSize: '0.9rem', margin: '0.5rem 0 1.5rem' }}>
                A view of your <Link to="/habits" style={{ color: 'var(--color-primary)' }}>Habits</Link>: add
                and delete them there. Tap one here to link it to what helps it. Formed helpers make it
                form faster, and a slipping one puts everything above it at risk.
            </p>

            <div ref={wrapRef} style={{ marginBottom: '1rem', minWidth: 0 }}>
                {layout && <CascadeTree sys={sys} layout={layout} selectedId={selectedId} onSelect={setSelectedId} />}
                {!nodes.length && <p style={{ ...dim, fontStyle: 'italic' }}>No habits yet.</p>}
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', fontSize: '0.8rem', ...dim }}>
                {Object.entries(KINDS).map(([k, def]) => (
                    <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: def.color }} /> {def.label}
                    </span>
                ))}
                <span><span style={{ color: WARN }}>⚠</span> slipping or at risk</span>
                <span>✓ done today</span>
            </div>

            {selected && (
                <div className="card animate-fade-in" style={{ borderColor: KINDS[selected.kind].color }}>
                    <h3 style={{ fontSize: '1.2rem' }}>{selected.name}</h3>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', margin: '0.75rem 0', fontSize: '0.85rem', ...dim }}>
                        <span>Strength <strong style={{ color: 'white' }}>{pct(selected.strength)}</strong></span>
                        {selected.c != null && (
                            <>
                                <span>Repeats banked <strong style={{ color: 'white' }}>{selected.c.toFixed(1)}</strong></span>
                                <span>Horizon <strong style={{ color: 'white' }}>{Math.round(selected.horizon)}</strong>
                                    {selected.support > 0 ? ` (${fadeDays} without helpers)` : ' repeats'}</span>
                            </>
                        )}
                    </div>
                    <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                        {(selected.status === 'slipping' || selected.atRisk) && <span style={{ color: WARN }}>⚠ </span>}
                        {statusLine(selected)}
                    </p>

                    {selected.kind !== 'outcome' && (
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                {selected.lock ? (
                                    <span style={{ ...dim, fontSize: '0.85rem' }}>{selected.lock}</span>
                                ) : (
                                    <button type="button" className={selected.loggedToday ? 'btn' : 'btn btn-primary'}
                                        onClick={() => toggleDay(selected, today)}
                                        style={{ padding: '0.6rem 1.4rem', fontSize: '0.95rem', ...(selected.loggedToday ? { background: 'rgba(255,255,255,0.1)', color: 'white' } : {}) }}>
                                        {selected.loggedToday ? 'Done today ✓' : 'Mark done today'}
                                    </button>
                                )}
                                <select className="custom-input" value={selected.perWeek} aria-label="How often"
                                    onChange={(e) => patch(selected, { perWeek: clampPerWeek(e.target.value) })}
                                    style={{ width: 'auto', padding: '0.5rem 0.8rem', fontSize: '0.9rem' }}>
                                    {CADENCES.map((n) => <option key={n} value={n}>{n === 7 ? 'Daily' : `${n}× a week`}</option>)}
                                </select>
                            </div>
                            <div style={sectionLabel}>Last 14 days{selected.lock ? '' : ' (tap to fix a day)'}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                                {lastDays(14, today).map((d) => {
                                    const on = selected.days.includes(d);
                                    return (
                                        <button key={d} type="button" disabled={!!selected.lock} title={d} aria-pressed={on}
                                            onClick={() => toggleDay(selected, d)}
                                            style={{
                                                height: '34px', borderRadius: '4px', fontSize: '0.8rem',
                                                cursor: selected.lock ? 'default' : 'pointer',
                                                border: d === today ? '1px solid rgba(255,255,255,0.5)' : '1px solid transparent',
                                                background: on ? KINDS[selected.kind].color : 'rgba(255,255,255,0.05)',
                                                color: on ? 'white' : 'var(--color-text-dim)',
                                            }}>
                                            {Number(d.slice(8))}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {selected.kind !== 'root' && (
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={sectionLabel}>{selected.kind === 'outcome' ? 'Which habits lead to this?' : 'Which habits help this?'}</div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {nodes.filter((h) => canHelp(h.id, selected.id, nodes)).map((h) => (
                                    <Chip key={h.id} active={selected.helpedBy.includes(h.id)} color={KINDS[h.kind].color}
                                        onClick={() => toggleHelper(selected, h.id)}>{h.name}</Chip>
                                ))}
                            </div>
                        </div>
                    )}

                    {!selected.folder && <div style={sectionLabel}>Role (saved as a tag on the habit)</div>}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {!selected.folder && Object.entries(KINDS).map(([k, def]) => (
                            <Chip key={k} active={selected.kind === k} color={def.color}
                                onClick={() => setRole(selected, k)}>{def.label}</Chip>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
