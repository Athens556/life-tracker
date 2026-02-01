import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini
// User needs to add VITE_GEMINI_API_KEY to .env
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const analyzeHabits = async (habits, userName = "User") => {
    if (!API_KEY) {
        console.error("Gemini API Key missing");
        return "Error: Please add VITE_GEMINI_API_KEY to your .env file.";
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    // Use the available model
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Prepare prompt with habit data
    const habitsSummary = habits.map(h => {
        const stats = h.goalType === 'numeric'
            ? `Goal: ${h.target} ${h.unit}, Last Log: ${JSON.stringify(h.logs || {})}`
            : `Completed Dates: ${h.completedDates?.length || 0}`;
        return `- ${h.text} (${h.category || 'Uncategorized'}): ${stats}`;
    }).join('\n');

    const prompt = `
    You are a motivational mood and habit coach named "Vibe AI".
    Analyze the following habit data for ${userName}:
    
    ${habitsSummary}

    1. Give a 1-sentence "Vibe Check" (encouraging or sassy).
    2. Suggest 1 specific thing to focus on tomorrow based on the data.
    3. Keep it short (max 50 words). Use emojis.
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini Error:", error);
        return "My vibe radar is offline right now. Try again later! 🤖";
    }
};
