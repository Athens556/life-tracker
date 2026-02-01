import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";

const API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

export const analyzeMyHabits = onCall({ cors: true }, async (request) => {
    if (!API_KEY) {
        throw new HttpsError('failed-precondition', 'API Key not found');
    }

    const { habits, userName } = request.data;

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
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini Error:", error);
        throw new HttpsError('internal', 'Failed to generate content');
    }
});
