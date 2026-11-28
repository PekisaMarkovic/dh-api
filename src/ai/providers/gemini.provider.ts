import { FinishReason, GoogleGenAI, Type } from '@google/genai';
import {
  AiFile,
  AiProvider,
  cleanItems,
  composeTitle,
  KnownDrink,
  purchasePrompt,
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

  async extractPurchaseItems(
    file: AiFile,
    drinks: KnownDrink[],
  ): Promise<PurchaseExtraction> {
    // images and PDFs are both sent inline
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: purchasePrompt(drinks) },
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
                required: ['name', 'quantity', 'drinkId'],
                properties: {
                  name: { type: Type.STRING },
                  quantity: { type: Type.INTEGER },
                  drinkId: { type: Type.INTEGER },
                },
              },
            },
          },
        },
      },
    });

    // anything but STOP is a cut answer (too long, blocked): some lines would be missing without a word
    const reason = response.candidates?.[0]?.finishReason;
    if (reason && reason !== FinishReason.STOP) {
      throw new Error(`The AI did not finish the answer (${reason})`);
    }

    const parsed = JSON.parse(response.text ?? '{"items":[]}') as {
      buyerName?: string;
      documentType?: string;
      documentNumber?: string;
      items: PurchaseItem[];
    };

    return {
      title: composeTitle(parsed),
      items: cleanItems(
        parsed.items,
        new Set(drinks.map((drink) => drink.drinkId)),
      ),
      raw: parsed,
    };
  }
}
