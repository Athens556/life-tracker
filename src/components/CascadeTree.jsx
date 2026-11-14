import { KINDS, NODE_H } from '../lib/cascade';

const WARN = '#feca57';
const pct = (v) => `${Math.round(v * 100)}%`;

// Pure view: HTML nodes over an SVG edge layer. Roots sit on the bottom row.
export default function CascadeTree({ sys, layout, selectedId, onSelect }) {
    const { width, height, nodeW, boxes, edges } = layout;

    return (
        <div style={{ overflowX: 'auto', paddingBottom: '0.25rem' }}>
            <div style={{ position: 'relative', width, height }}>
                <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
                    {edges.map((e) => {
                        const from = sys.get(e.from);
                        const warn = from.status === 'slipping' || from.atRisk;
                        const active = selectedId === e.from || selectedId === e.to;
                        const dim = selectedId && !active;
                        return (
                            <path key={`${e.from}>${e.to}`} d={e.d} fill="none"
                                stroke={warn ? WARN : KINDS[from.kind].color}
                                strokeWidth={active ? 3 : 2}
                                strokeDasharray={warn ? '5 5' : undefined}
                                strokeLinecap="round"
                                opacity={dim ? 0.15 : 0.35 + 0.55 * from.strength} />
                        );
                    })}
                </svg>

                {[...sys.values()].map((n) => {
                    const box = boxes.get(n.id);
                    const color = KINDS[n.kind].color;
                    const selected = selectedId === n.id;
                    const warn = n.status === 'slipping' || n.atRisk;
                    const note = n.status === 'slipping' ? 'slipping' : n.atRisk ? 'at risk' : n.status;
                    return (
                        <button key={n.id} type="button" onClick={() => onSelect(selected ? null : n.id)}
                            aria-pressed={selected}
                            title={`${n.name} · ${KINDS[n.kind].label} · ${pct(n.strength)} · ${note}`}
                            style={{
                                position: 'absolute', left: box.x, top: box.y, width: nodeW, height: NODE_H,
                                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                                padding: '8px 10px', textAlign: 'left', cursor: 'pointer',
                                fontFamily: 'inherit', color: 'var(--color-text)',
                                background: selected ? 'var(--color-surface-hover)' : 'var(--color-surface)',
                                border: `1px solid ${selected ? color : 'rgba(255,255,255,0.1)'}`,
                                borderLeft: `3px solid ${color}`,
                                borderRadius: '10px', transition: 'var(--transition)',
                            }}>
                            <span style={{ display: 'flex', justifyContent: 'space-between', gap: 4, alignItems: 'flex-start' }}>
                                <span style={{
                                    fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden',
                                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                }}>{n.name}</span>
                                {n.loggedToday && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>✓</span>}
                            </span>
                            <span>
                                <span style={{
                                    display: 'flex', justifyContent: 'space-between', gap: 4,
                                    fontSize: '0.68rem', color: 'var(--color-text-dim)', marginBottom: 4, whiteSpace: 'nowrap',
                                }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {warn && <span style={{ color: WARN }}>⚠ </span>}{note}
                                    </span>
                                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{pct(n.strength)}</span>
                                </span>
                                <span style={{ display: 'block', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                                    <span style={{ display: 'block', height: '100%', width: pct(n.strength), background: color, borderRadius: 2 }} />
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
