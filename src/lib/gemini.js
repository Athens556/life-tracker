import { functions } from "./firebase";
import { httpsCallable } from "firebase/functions";

export const analyzeHabits = async (habits, userName = "User") => {
    // Disabled to prevent billing
    return "AI features are currently disabled. (Billing Protection)";
};

