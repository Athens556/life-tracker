import { useState } from 'react';

export default function HabitCalendar({ completedDates = [], onToggleDate }) {
    const [currentDate, setCurrentDate] = useState(new Date());

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        return days;
    };

    const getFirstDayOfMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month, 1).getDay();
    };

    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const renderDays = () => {
        const days = [];

        // Empty cells for offset
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} style={{ height: '30px' }}></div>);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            // Format: YYYY-MM-DD
            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isCompleted = completedDates.includes(dateStr);

            days.push(
                <button
                    key={d}
                    onClick={() => onToggleDate(dateStr)}
                    style={{
                        height: '30px',
                        width: '100%',
                        border: 'none',
                        background: isCompleted ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
                        color: isCompleted ? 'white' : 'var(--color-text-dim)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    title={dateStr}
                >
                    {d}
                </button>
            );
        }
        return days;
    };

    return (
        <div className="animate-fade-in" style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <button onClick={handlePrevMonth} style={{ background: 'none', border: 'none', color: 'var(--color-text)', cursor: 'pointer' }}>←</button>
                <span style={{ fontWeight: 600 }}>{monthName} {year}</span>
                <button onClick={handleNextMonth} style={{ background: 'none', border: 'none', color: 'var(--color-text)', cursor: 'pointer' }}>→</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '4px' }}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i} style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>{d}</div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                {renderDays()}
            </div>
        </div>
    );
}
