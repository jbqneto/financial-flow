import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

export const getFinancialInsights = async (transactions: Transaction[]): Promise<string> => {
  // Fix: Direct use of process.env.API_KEY as per initialization guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const summary = transactions.slice(0, 50).map(t => ({
    d: t.description,
    a: t.amount,
    c: t.category,
    t: t.type
  }));

  const prompt = `
    Analyze these recent financial transactions and provide 3-4 concise, actionable financial tips or observations.
    Focus on spending patterns, potential savings, and category distribution.
    Format as short bullet points in Portuguese.
    
    Data: ${JSON.stringify(summary)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    // Fix: Access the .text property directly (it is a property, not a method)
    return response.text || "Não foi possível gerar insights no momento.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao conectar com a IA financeira.";
  }
};