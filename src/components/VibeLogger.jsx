import { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const VIBES = [
    { p: 1, e: '🌩️', l: 'Stormy' },
    { p: 2, e: '🌧️', l: 'Rainy' },
    { p: 3, e: '☁️', l: 'Cloudy' },
    { p: 4, e: '⛅', l: 'Sunny' },
    { p: 5, e: '☀️', l: 'Radiant' },
];

export default function VibeLogger({ user }) {
    const [selectedVibe, setSelectedVibe] = useState(null);
    const [saving, setSaving] = useState(false);

    const logVibe = async (vibe) => {
        if (!user) return;
        setSelectedVibe(vibe.p);
        setSaving(true);

        try {
            await addDoc(collection(db, 'vibes'), {
                userId: user.uid,
                level: vibe.p,
                label: vibe.l,
                timestamp: serverTimestamp(),
            });

            // Reset selection after a moment to allow logging again later
            setTimeout(() => {
                setSelectedVibe(null);
                setSaving(false);
            }, 2000);
        } catch (err) {
            console.error(err);
            setSaving(false);
        }
    };

    return (
        <div className="card" style={{ maxWidth: '800px', margin: '2rem auto', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>How's your vibe right now?</h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                {VIBES.map((v) => (
                    <button
                        key={v.p}
                        onClick={() => logVibe(v)}
                        disabled={saving}
                        style={{
                            fontSize: '2rem',
                            padding: '1rem',
                            borderRadius: 'var(--radius-md)',
                            border: selectedVibe === v.p ? '2px solid var(--color-primary)' : '2px solid transparent',
                            background: selectedVibe === v.p ? 'var(--color-surface-hover)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'var(--transition)',
                            transform: selectedVibe === v.p ? 'scale(1.1)' : 'scale(1)'
                        }}
                        title={v.l}
                    >
                        {v.e}
                    </button>
                ))}
            </div>
            {saving && <p className="animate-fade-in" style={{ marginTop: '1rem', color: 'var(--color-primary)' }}>Vibe captured!</p>}
        </div>
    );
}
