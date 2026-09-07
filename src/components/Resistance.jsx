import { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, deleteDoc, doc, query, where, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import CravingButton from './CravingButton';
import {
    CATEGORIES, DEFAULT_FADE_DAYS, MIN_FADE_DAYS, MAX_FADE_DAYS, clampFadeDays,
    normalizeAct, extractMag, localDayKey, addDays, scoreHistory, liveValue,
} from '../lib/resistance';

const round1 = (v) => Math.round(v * 10) / 10;

const inputStyle = {
    padding: '0.8rem',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: 'var(--color-bg)',
    color: 'white',
};

function CategoryDot({ cat, size = 10 }) {
    return (
        <span style={{
            width: size, height: size, borderRadius: '50%', flexShrink: 0,
            background: CATEGORIES[cat].color, display: 'inline-block',
        }} />
    );
}

// 14-day stacked-bar trace: one column per day, one segment per scored entry.
function Trace({ days, today }) {
    const W = 560, H = 150, plotH = 118, baseY = 128, colW = W / days.length, barW = 26;
    const maxTotal = Math.max(1, ...days.map((d) => d.total));

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Resistance index, last 14 days">
            {days.map((d, i) => {
                const x = i * colW + (colW - barW) / 2;
                let y = baseY;
                const isToday = d.dayKey === today;
                return (
                    <g key={d.dayKey}>
                        {isToday && (
                            <rect x={i * colW + 1} y={4} width={colW - 2} height={baseY + 4}
                                fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" rx="6" />
                        )}
                        {/* thin baseline so empty days read as zero, not a gap */}
                        <rect x={x} y={baseY} width={barW} height={2} fill="rgba(255,255,255,0.15)" rx="1" />
                        {d.segments.map((s) => {
                            const h = Math.max(2, (s.value / maxTotal) * plotH);
                            y -= h;
                            const rect = (
                                <rect key={s.id} x={x} y={y} width={barW} height={h}
                                    fill={CATEGORIES[s.cat].color} rx="2">
                                    <title>{`${s.label} · +${s.value} (${CATEGORIES[s.cat].name})`}</title>
                                </rect>
                            );
                            y -= 2; // 2px surface gap between stacked segments
                            return rect;
                        })}
                        {d.total > 0 && isToday && (
                            <text x={i * colW + colW / 2} y={Math.max(12, y - 4)} textAnchor="middle"
                                fill="var(--color-text)" fontSize="11" fontWeight="600">
                                {d.total}
                            </text>
                        )}
                        {(i % 3 === 0 || isToday) && (
                            <text x={i * colW + colW / 2} y={H - 6} textAnchor="middle"
                                fill="var(--color-text-dim)" fontSize="10">
                                {isToday ? 'today' : d.dayKey.slice(8)}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}

// Hour-of-day histogram, 24 buckets — when do cravings actually cluster?
function CravingHistogram({ buckets }) {
    const W = 560, H = 120, plotH = 88, baseY = 100, colW = W / 24, barW = 16;
    const max = Math.max(1, ...buckets);
    const maxIdx = buckets.indexOf(Math.max(...buckets));

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Cravings by hour of day">
            {buckets.map((n, hour) => {
                const h = n > 0 ? Math.max(3, (n / max) * plotH) : 2;
                const x = hour * colW + (colW - barW) / 2;
                return (
                    <g key={hour}>
                        <rect x={x} y={baseY - h} width={barW} height={h} rx="2"
                            fill={n > 0 ? '#884dff' : 'rgba(255,255,255,0.12)'}>
                            <title>{`${String(hour).padStart(2, '0')}:00–${String((hour + 1) % 24).padStart(2, '0')}:00 · ${n} craving${n === 1 ? '' : 's'}`}</title>
                        </rect>
                        {n > 0 && hour === maxIdx && (
                            <text x={hour * colW + colW / 2} y={baseY - h - 5} textAnchor="middle"
                                fill="var(--color-text)" fontSize="11" fontWeight="600">{n}</text>
                        )}
                    </g>
                );
            })}
            {[0, 6, 12, 18].map((hr) => (
                <text key={hr} x={hr * colW + colW / 2} y={H - 4} textAnchor="middle"
                    fill="var(--color-text-dim)" fontSize="10">
                    {String(hr).padStart(2, '0')}:00
                </text>
            ))}
        </svg>
    );
}

function formatMinutes(mins) {
    const h = Math.floor(mins / 60), m = Math.round(mins % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function Resistance({ user }) {
    const [entries, setEntries] = useState([]);
    const [cravings, setCravings] = useState([]);
    const [fadeDays, setFadeDays] = useState(DEFAULT_FADE_DAYS);
    const [expandedCat, setExpandedCat] = useState(null);
    const [drafts, setDrafts] = useState({});       // { cat: label text }
    const [newContext, setNewContext] = useState({}); // { cat: bool }
    const [copied, setCopied] = useState(false);

    const today = localDayKey();

    useEffect(() => {
        if (!user) return;
        const qE = query(collection(db, 'resistanceEntries'), where('userId', '==', user.uid));
        const unsubE = onSnapshot(qE, (snap) => {
            setEntries(snap.docs.map((d) => {
                const data = d.data();
                return { id: d.id, ...data, createdAt: data.createdAt?.toMillis?.() ?? Date.now() };
            }));
        });
        const qC = query(collection(db, 'cravings'), where('userId', '==', user.uid));
        const unsubC = onSnapshot(qC, (snap) => {
            setCravings(snap.docs.map((d) => {
                const data = d.data();
                return { id: d.id, ...data, createdAt: data.createdAt?.toMillis?.() ?? Date.now() };
            }));
        });
        const unsubS = onSnapshot(doc(db, 'resistanceSettings', user.uid), (snap) => {
            if (snap.exists()) setFadeDays(clampFadeDays(snap.data().fadeDays));
        });
        return () => { unsubE(); unsubC(); unsubS(); };
    }, [user]);

    const { results, groups } = useMemo(() => scoreHistory(entries, fadeDays), [entries, fadeDays]);

    const traceDays = useMemo(() => {
        return [...Array(14)].map((_, i) => {
            const dayKey = addDays(today, i - 13);
            const segments = results.filter((r) => r.dayKey === dayKey && r.value > 0);
            return { dayKey, segments, total: round1(segments.reduce((s, r) => s + r.value, 0)) };
        });
    }, [results, today]);

    const todayTotal = traceDays[13].total;

    const todayEntries = useMemo(() => {
        const list = results.filter((r) => r.dayKey === today).reverse();
        // Collapse craving taps into a single row so ten fridge-taps don't flood the list.
        const cravingRows = list.filter((r) => r.act === 'craving');
        const rest = list.filter((r) => r.act !== 'craving');
        return { rest, cravingCount: cravingRows.length, cravingValue: round1(cravingRows.reduce((s, r) => s + r.value, 0)) };
    }, [results, today]);

    // Known acts per category, with what each would score right now.
    const actsByCat = useMemo(() => {
        const map = { N: [], P: [], C: [], R: [] };
        for (const [key, g] of groups) {
            const [cat, act] = key.split('|');
            if (act === 'craving') continue; // craving has its own button
            map[cat]?.push({ act, label: g.lastLabel, live: liveValue(cat, act, groups, fadeDays, today) });
        }
        for (const cat of Object.keys(map)) map[cat].sort((a, b) => b.live.value - a.live.value);
        return map;
    }, [groups, fadeDays, today]);

    const cravingStats = useMemo(() => {
        const buckets = Array(24).fill(0);
        const minutes = [];
        for (const c of cravings) {
            const d = new Date(c.createdAt);
            buckets[d.getHours()]++;
            minutes.push(d.getHours() * 60 + d.getMinutes());
        }
        minutes.sort((a, b) => a - b);
        const median = minutes.length ? minutes[Math.floor(minutes.length / 2)] : null;
        const last7 = new Set([...Array(7)].map((_, i) => addDays(today, -i)));
        const weekCount = cravings.filter((c) => last7.has(c.dayKey)).length;
        return {
            buckets,
            todayCount: cravings.filter((c) => c.dayKey === today).length,
            median,
            weekAvg: round1(weekCount / 7),
        };
    }, [cravings, today]);

    const logEntry = async (cat, label, isNewContext) => {
        const trimmed = label.trim();
        if (!trimmed) return;
        await addDoc(collection(db, 'resistanceEntries'), {
            userId: user.uid,
            cat,
            label: trimmed,
            act: normalizeAct(trimmed),
            mag: extractMag(trimmed),
            newContext: !!isNewContext,
            dayKey: localDayKey(),
            createdAt: serverTimestamp(),
        });
        setDrafts((p) => ({ ...p, [cat]: '' }));
        setNewContext((p) => ({ ...p, [cat]: false }));
    };

    const deleteEntry = async (id) => {
        await deleteDoc(doc(db, 'resistanceEntries', id));
    };

    const saveFadeDays = async (n) => {
        const clamped = clampFadeDays(Number(n));
        setFadeDays(clamped);
        await setDoc(doc(db, 'resistanceSettings', user.uid), { userId: user.uid, fadeDays: clamped }, { merge: true });
    };

    const exportJson = async () => {
        const payload = {
            exportedAt: new Date().toISOString(),
            fadeDays,
            entries: results.map(({ id, cat, label, act, mag, newContext: nc, dayKey, createdAt, value, reason }) => ({
                id, cat, label, act, mag, newContext: nc, dayKey,
                createdAt: new Date(createdAt).toISOString(), value, reason,
            })),
            cravings: cravings.map(({ id, dayKey, createdAt }) => ({
                id, dayKey, createdAt: new Date(createdAt).toISOString(),
            })),
        };
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const chipLabel = (live) => {
        if (live.reason === 'already logged today') return 'logged ✓';
        if (live.reason === 'routine now') return 'routine now';
        return `+${live.value}`;
    };

    return (
        <div className="container animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', paddingTop: '2rem', paddingBottom: '3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h2>Resistance Index</h2>
                <button onClick={exportJson} className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
                    {copied ? 'Copied ✓' : 'Export JSON'}
                </button>
            </div>
            <p style={{ color: 'var(--color-text-dim)', fontSize: '0.9rem', margin: '0.5rem 0 1.5rem' }}>
                A repeated act is worth less each time. A falling index means habits are
                automating — that is the goal, not a slip.
            </p>

            {/* 14-day trace + today's total */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
                    <span style={{ color: 'var(--color-text-dim)', fontSize: '0.85rem' }}>Last 14 days</span>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, lineHeight: 1 }}>{todayTotal}</div>
                        <div style={{ color: 'var(--color-text-dim)', fontSize: '0.8rem' }}>today</div>
                    </div>
                </div>
                <Trace days={traceDays} today={today} />
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                    {Object.entries(CATEGORIES).map(([cat, def]) => (
                        <span key={cat} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>
                            <CategoryDot cat={cat} /> {def.name}
                        </span>
                    ))}
                </div>
            </div>

            {/* Category cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {Object.entries(CATEGORIES).map(([cat, def]) => {
                    const expanded = expandedCat === cat;
                    return (
                        <div key={cat} className="card" style={{ cursor: expanded ? 'default' : 'pointer', borderColor: expanded ? def.color : undefined }}
                            onClick={() => !expanded && setExpandedCat(cat)}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}
                                onClick={() => expanded && setExpandedCat(null)}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <CategoryDot cat={cat} size={12} />
                                    <strong>{def.name}</strong>
                                </div>
                                <span style={{ color: 'var(--color-text-dim)', fontSize: '0.85rem' }}>
                                    base +{def.base}{def.fades ? '' : ' · never fades'}
                                </span>
                            </div>

                            {expanded && (
                                <div className="animate-fade-in" style={{ marginTop: '1rem' }} onClick={(e) => e.stopPropagation()}>
                                    {actsByCat[cat].length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                                            {actsByCat[cat].map(({ act, label, live }) => (
                                                <button key={act}
                                                    onClick={() => live.reason !== 'already logged today' && logEntry(cat, label, newContext[cat])}
                                                    style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                                        padding: '0.5rem 0.9rem', borderRadius: 'var(--radius-full)',
                                                        border: `1px solid ${def.color}55`, background: 'rgba(255,255,255,0.05)',
                                                        color: 'white', cursor: live.reason === 'already logged today' ? 'default' : 'pointer',
                                                        opacity: live.reason === 'already logged today' ? 0.5 : 1,
                                                        fontSize: '0.9rem', transition: 'var(--transition)',
                                                    }}>
                                                    {label}
                                                    <span style={{ color: def.color, fontWeight: 600, fontSize: '0.8rem' }}>
                                                        {chipLabel(live)}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <form onSubmit={(e) => { e.preventDefault(); logEntry(cat, drafts[cat] || '', newContext[cat]); }}
                                        style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                        <input
                                            type="text"
                                            value={drafts[cat] || ''}
                                            onChange={(e) => setDrafts((p) => ({ ...p, [cat]: e.target.value }))}
                                            placeholder="New act (e.g. run 1.05 km)"
                                            style={inputStyle}
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--color-text-dim)', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={newContext[cat] || false}
                                                    onChange={(e) => setNewContext((p) => ({ ...p, [cat]: e.target.checked }))} />
                                                New context (travel, stress week…)
                                            </label>
                                            <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.2rem', fontSize: '0.9rem' }}>Log</button>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Today's entries */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--color-text-dim)', marginBottom: '1rem' }}>Today</h3>
                {todayEntries.rest.length === 0 && todayEntries.cravingCount === 0 && (
                    <p style={{ color: 'var(--color-text-dim)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                        Nothing yet. A quiet day is a gap, not a broken chain.
                    </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {todayEntries.cravingCount > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <CategoryDot cat="N" />
                            <span style={{ flex: 1 }}>craving ×{todayEntries.cravingCount}</span>
                            <strong style={{ color: CATEGORIES.N.color }}>+{todayEntries.cravingValue}</strong>
                        </div>
                    )}
                    {todayEntries.rest.map((r) => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <CategoryDot cat={r.cat} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <span>{r.label}</span>
                                {r.reason && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>{r.reason}</div>
                                )}
                            </div>
                            <strong style={{ color: CATEGORIES[r.cat].color }}>+{r.value}</strong>
                            <button onClick={() => deleteEntry(r.id)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-dim)', cursor: 'pointer', opacity: 0.5 }}>✕</button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Craving counter */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--color-text-dim)' }}>Cravings resisted</h3>
                    <div style={{ fontSize: '2rem', fontWeight: 700 }}>{cravingStats.todayCount}<span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--color-text-dim)' }}> today</span></div>
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                    <CravingButton user={user} />
                </div>
                <CravingHistogram buckets={cravingStats.buckets} />
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>
                    <span>Median time: <strong style={{ color: 'white' }}>{cravingStats.median != null ? formatMinutes(cravingStats.median) : '—'}</strong></span>
                    <span>7-day avg: <strong style={{ color: 'white' }}>{cravingStats.weekAvg}/day</strong></span>
                </div>
            </div>

            {/* Fade index control */}
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <label htmlFor="fade-days" style={{ fontSize: '0.9rem' }}>
                        Fade horizon: <strong>{fadeDays} days</strong>
                    </label>
                    <input
                        id="fade-days"
                        type="range"
                        min={MIN_FADE_DAYS}
                        max={MAX_FADE_DAYS}
                        value={fadeDays}
                        onChange={(e) => saveFadeDays(e.target.value)}
                        style={{ flex: 1, minWidth: '150px', accentColor: 'var(--color-primary)' }}
                    />
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginTop: '0.5rem' }}>
                    How many daily repeats it takes an act to fade to near zero. Changing it rescores all history.
                </p>
            </div>
        </div>
    );
}
