import { PdfService, ProformaPdfData } from '@/pdf/services/pdf.service';

describe('PdfService', () => {
  let service: PdfService;

  const item = (index: number) => ({
    code: String(index),
    name: `PIĆE ${index} ŠLJIVOVICA 0.7L`,
    quantity: 2,
    unitPrice: 100,
    discountPercent: 0,
    lineTotal: 200,
  });

  const data = (overrides: Partial<ProformaPdfData> = {}): ProformaPdfData => ({
    documentNumber: '40/26',
    seller: {
      name: 'DRINK HOUSE',
      street: 'FILIPA KLJAJIĆA 82',
      city: 'LOZNICA',
      pib: '115962350',
      registrationNumber: '68783143',
      phone: null,
      bankAccount: '160600000276128785',
    },
    createdAt: new Date('2026-11-09T10:00:00'),
    warehouseId: 1,
    warehouseName: 'PRODAVNICA BR.1',
    customerName: 'PRIVATNA ZURKA',
    createdByName: 'Milutin',
    total: 9756,
    items: [item(1), item(2), item(3), item(4)],
    ...overrides,
  });

  // how many pages the file has
  const pagesOf = (pdf: Buffer) =>
    (pdf.toString('latin1').match(/\/Type \/Page(?!s)/g) ?? []).length;

  beforeEach(() => {
    service = new PdfService();
  });

  describe('renderProforma', () => {
    it('should return a PDF file', async () => {
      const pdf = await service.renderProforma(data());

      expect(Buffer.isBuffer(pdf)).toBe(true);
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.subarray(-6).toString()).toContain('%%EOF');
    });

    it('should make a document of one page for a short proforma', async () => {
      const pdf = await service.renderProforma(data());

      expect(pagesOf(pdf)).toBe(1);
    });

    it('should go on on a next page when the lines do not fit', async () => {
      const items = Array.from({ length: 80 }, (_, index) => item(index + 1));

      const pdf = await service.renderProforma(data({ items }));

      expect(pagesOf(pdf)).toBeGreaterThan(1);
    });

    it('should make the PDF of a proforma without lines', async () => {
      const pdf = await service.renderProforma(data({ items: [], total: 0 }));

      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('should leave the box of the buyer empty when there is none', async () => {
      await expect(
        service.renderProforma(data({ customerName: null })),
      ).resolves.toBeDefined();
    });

    it('should print a phone number when the company has one', async () => {
      const base = data();

      await expect(
        service.renderProforma({
          ...base,
          seller: { ...base.seller, phone: '064123456' },
        }),
      ).resolves.toBeDefined();
    });

    it('should not fail on a line without a code, a discount or a long name', async () => {
      const items = [
        { ...item(1), code: null },
        { ...item(2), discountPercent: 12.5, lineTotal: 175 },
        { ...item(3), name: 'VEOMA DUGACAK NAZIV PICA '.repeat(10) },
      ];

      await expect(
        service.renderProforma(data({ items })),
      ).resolves.toBeDefined();
    });

    it('should not fail on a very big amount', async () => {
      await expect(
        service.renderProforma(data({ total: 123_456_789.55 })),
      ).resolves.toBeDefined();
    });

    it('should make a different file when the data is different', async () => {
      const first = await service.renderProforma(data());
      const second = await service.renderProforma(
        data({ documentNumber: '41/26', customerName: 'DRUGI KUPAC' }),
      );

      expect(first.equals(second)).toBe(false);
    });
  });
});
