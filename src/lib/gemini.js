import { functions } from "./firebase";
import { httpsCallable } from "firebase/functions";

export const analyzeHabits = async (habits, userName = "User") => {
    const analyzeMyHabits = httpsCallable(functions, 'analyzeMyHabits');
    try {
        const result = await analyzeMyHabits({ habits, userName });
        return result.data;
    } catch (error) {
        console.error("Gemini Error:", error);
        return "My vibe radar is offline right now. Try again later! 🤖";
    }
};
