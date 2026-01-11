
import { Transaction } from "../types";
import { parseRevolutCSV, parseMillenniumCSV, applyRulesToTransaction } from "../utils";

interface UploadResponse {
  success: boolean;
  message: string;
  data?: Transaction[];
}

/**
 * Simulates a backend endpoint that receives a file and decides how to parse it.
 */
export const uploadFileService = async (file: File, autoRules: any[]): Promise<UploadResponse> => {
  return new Promise((resolve) => {
    // Simulate network delay
    setTimeout(async () => {
      try {
        const fileName = file.name.toLowerCase();
        let parsed: Transaction[] = [];

        // Logic simulated as "backend logic" to detect format
        const text = await file.text();
        
        if (fileName.includes('revolut')) {
          parsed = parseRevolutCSV(text);
        } else if (fileName.includes('millennium') || text.includes(';')) {
          parsed = parseMillenniumCSV(text);
        } else {
          // If we don't recognize it, we might fail or try a generic parse
          // For the sake of this demo, let's treat unknown as generic CSV (Revolut-like)
          parsed = parseRevolutCSV(text);
        }

        if (parsed.length === 0) {
          throw new Error("Formato de arquivo não reconhecido ou vazio.");
        }

        const enrichedData = parsed.map(t => applyRulesToTransaction(t, autoRules));

        resolve({
          success: true,
          message: `${enrichedData.length} transações importadas com sucesso!`,
          data: enrichedData
        });
      } catch (error: any) {
        resolve({
          success: false,
          message: error.message || "Erro ao processar o arquivo no servidor."
        });
      }
    }, 1500);
  });
};
