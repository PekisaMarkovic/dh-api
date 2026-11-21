import { GoogleGenAI, Type } from '@google/genai';
import {
  AiFile,
  AiProvider,
  cleanItems,
  composeTitle,
  PURCHASE_PROMPT,
  PurchaseExtraction,
  PurchaseItem,
} from '@/ai/ai.types';

export class GeminiProvider implements AiProvider {
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async extractPurchaseItems(file: AiFile): Promise<PurchaseExtraction> {
    // images and PDFs are both sent inline
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: PURCHASE_PROMPT },
            {
              inlineData: {
                mimeType: file.mimetype,
                data: file.buffer.toString('base64'),
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['buyerName', 'documentType', 'documentNumber', 'items'],
          properties: {
            buyerName: { type: Type.STRING },
            documentType: { type: Type.STRING },
            documentNumber: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ['name', 'quantity'],
                properties: {
                  name: { type: Type.STRING },
                  quantity: { type: Type.INTEGER },
                },
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse(response.text ?? '{"items":[]}') as {
      buyerName?: string;
      documentType?: string;
      documentNumber?: string;
      items: PurchaseItem[];
    };

    return {
      title: composeTitle(parsed),
      items: cleanItems(parsed.items),
      raw: parsed,
    };
  }
}
