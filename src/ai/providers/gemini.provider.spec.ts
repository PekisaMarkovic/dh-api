import { GoogleGenAI } from '@google/genai';
import { GeminiProvider } from '@/ai/providers/gemini.provider';

jest.mock('@google/genai', () => ({
  ...jest.requireActual('@google/genai'),
  GoogleGenAI: jest.fn(),
}));

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  let generateContent: jest.Mock;

  const file = {
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4'),
    originalname: 'petar.pdf',
  };

  const drinks = [
    { drinkId: 128, name: 'Fanta 1.5L' },
    { drinkId: 2, name: 'Tuborg 0.33L' },
  ];

  const answer = (body: unknown) => ({ text: JSON.stringify(body) });

  beforeEach(() => {
    generateContent = jest.fn();
    (GoogleGenAI as unknown as jest.Mock).mockImplementation(() => ({
      models: { generateContent },
    }));
    provider = new GeminiProvider('secret-key', 'gemini-test-model');
  });

  it('should create the client with the key', () => {
    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'secret-key' });
  });

  it('should send the document as it is, with its type, to the model that was chosen', async () => {
    generateContent.mockResolvedValue(answer({ items: [] }));

    await provider.extractPurchaseItems(file, drinks);

    const request = generateContent.mock.calls[0][0];
    expect(request.model).toBe('gemini-test-model');
    const [instruction, document] = request.contents[0].parts;
    expect(instruction.text).toContain('purchase document');
    // the drinks of the warehouse, so the AI matches the lines to them
    expect(instruction.text).toContain('128: Fanta 1.5L');
    expect(document.inlineData).toEqual({
      mimeType: 'application/pdf',
      data: file.buffer.toString('base64'),
    });
  });

  it('should ask for JSON in the shape of the schema', async () => {
    generateContent.mockResolvedValue(answer({ items: [] }));

    await provider.extractPurchaseItems(file, drinks);

    const { config } = generateContent.mock.calls[0][0];
    expect(config.responseMimeType).toBe('application/json');
    expect(config.responseSchema.required).toEqual(
      expect.arrayContaining([
        'buyerName',
        'documentType',
        'documentNumber',
        'items',
      ]),
    );
  });

  it('should return the lines, the name of the document and the answer as it came', async () => {
    const raw = {
      buyerName: 'PRIVATNA ZURKA',
      documentType: 'Predracun',
      documentNumber: '40/26',
      items: [
        { name: 'FANTA 1.5L', quantity: 2, drinkId: 128 },
        { name: 'TUBORG 0.33L', quantity: 48, drinkId: 2 },
      ],
    };
    generateContent.mockResolvedValue(answer(raw));

    await expect(provider.extractPurchaseItems(file, drinks)).resolves.toEqual({
      title: 'PRIVATNA ZURKA Predracun 40/26',
      items: raw.items,
      raw,
    });
  });

  it('should clean the lines that the model got wrong', async () => {
    generateContent.mockResolvedValue(
      answer({
        items: [
          { name: ' FANTA ', quantity: 2.7 },
          { name: '', quantity: 1 },
          { name: 'PEPSI', quantity: 0 },
        ],
      }),
    );

    const { items } = await provider.extractPurchaseItems(file, drinks);

    expect(items).toEqual([{ name: 'FANTA', quantity: 2, drinkId: null }]);
  });

  it('should return no title when the model found nothing in the head of the document', async () => {
    generateContent.mockResolvedValue(
      answer({
        buyerName: '',
        documentType: '',
        documentNumber: '',
        items: [],
      }),
    );

    const { title } = await provider.extractPurchaseItems(file, drinks);

    expect(title).toBeNull();
  });

  it('should return no lines when the model sends no text', async () => {
    generateContent.mockResolvedValue({ text: undefined });

    await expect(provider.extractPurchaseItems(file, drinks)).resolves.toEqual(
      expect.objectContaining({ items: [], title: null }),
    );
  });

  it('should throw when the model does not send JSON, so it is not taken for an empty document', async () => {
    generateContent.mockResolvedValue({ text: 'Sorry, I can not read this' });

    await expect(provider.extractPurchaseItems(file, drinks)).rejects.toThrow();
  });

  it('should throw when the answer was cut, so no line is lost without a word', async () => {
    generateContent.mockResolvedValue({
      ...answer({ items: [{ name: 'FANTA', quantity: 1, drinkId: 128 }] }),
      candidates: [{ finishReason: 'MAX_TOKENS' }],
    });

    await expect(provider.extractPurchaseItems(file, drinks)).rejects.toThrow(
      'MAX_TOKENS',
    );
  });

  it('should accept a finished answer', async () => {
    generateContent.mockResolvedValue({
      ...answer({ items: [] }),
      candidates: [{ finishReason: 'STOP' }],
    });

    await expect(
      provider.extractPurchaseItems(file, drinks),
    ).resolves.toBeDefined();
  });

  it('should throw the error of the model as it is, so the status can be read', async () => {
    const error = Object.assign(new Error('overloaded'), { status: 503 });
    generateContent.mockRejectedValue(error);

    await expect(provider.extractPurchaseItems(file, drinks)).rejects.toBe(
      error,
    );
  });
});
