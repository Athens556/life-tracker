import { createContext, useContext } from 'react';

// ONE SOURCE OF TRUTH at runtime too: the app holds a single live listener on
// `habits` (components/HabitsProvider.jsx). Every page reads it with useHabits().
// Do not add another onSnapshot on `habits` anywhere.
export const HabitsContext = createContext([]);

export function useHabits() {
    return useContext(HabitsContext);
}
