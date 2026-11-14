import { createContext, useContext } from 'react';

// ONE SOURCE OF TRUTH at runtime too: the app holds a single live listener on
// `habits` and one on `habitFolders` (components/HabitsProvider.jsx). Every page
// reads them with useHabits() / useFolders(). Do not add another onSnapshot on
// either collection anywhere.
export const HabitsContext = createContext([]);
export const FoldersContext = createContext(new Map());

export function useHabits() {
    return useContext(HabitsContext);
}

// Map folder name -> folder doc ({ type, helpedBy, perWeek }).
export function useFolders() {
    return useContext(FoldersContext);
}
