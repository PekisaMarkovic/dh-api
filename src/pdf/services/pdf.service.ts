import { Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import * as path from 'path';
import { PROFORMA_PDF_MOCK } from '@/pdf/proforma-pdf.mock';
import { amountInWords } from '@/pdf/helpers/number-to-words';
import { lineTotalCents, vatCents } from '@/common/helpers/money.helpers';
import { VAT_RATE_PERCENT } from '@/common/constants/vat';
// pdfkit is a CommonJS `export =` module and this project has no esModuleInterop,
// so a default import would be undefined at runtime
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PDFDocument = require('pdfkit');

export type ProformaPdfData = {
  /** The number that is printed on the document, e.g. 40/26 */
  documentNumber: string;
  /** The seller: the company that made the proforma, from the companies table */
  seller: {
    name: string;
    street: string;
    city: string;
    pib: string;
    registrationNumber: string;
    phone: string | null;
    bankAccount: string;
  };
  createdAt: Date;
  warehouseId: number;
  warehouseName: string;
  /** The buyer, the box stays empty when there is none */
  customerName: string | null;
  createdByName: string;
  total: number;
  items: {
    code: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    /** unitPrice * quantity, after the discount (with VAT) */
    lineTotal: number;
  }[];
};

type TextOptions = {
  align?: 'left' | 'right' | 'center';
  size?: number;
  bold?: boolean;
  underline?: boolean;
};

// The layout is measured on a picture of the original document (919 x 1300 px),
// so every coordinate below is in those pixels and is converted to PDF points.
const SCALE = 919 / 595.28;
const pt = (px: number) => px / SCALE;

// thickness of the lines (points) and the extra weight of the letters (part of the font size)
const LINE_WIDTH = 1.1;
const BOX_LINE_WIDTH = 0.85;
const TEXT_WEIGHT = 0.011;

// the table and its blue band start at the left margin of the text and end at the right edge
const TABLE_LEFT = 48;
const TABLE_RIGHT = 877;
const BAND_TOP = 405.3;
const BAND_HEIGHT = 31.2;
const FIRST_ROW_Y = 450;
const ROW_HEIGHT = 20.4;
const ROWS_BOTTOM_LIMIT = 1185;
const SUMMARY_HEIGHT = 215;
const FOOTER_Y = 1237;
const CONTINUED_TABLE_TOP = 70;

// right edges (and centers) of the table columns
const COLUMN = {
  rowNumber: 71,
  code: 115,
  name: 120,
  unit: 288,
  quantity: 356,
  price: 452,
  amount: 514,
  discount: 557,
  netAmount: 643,
  vatRate: 690,
  vat: 737,
  grossPrice: 790,
  grossAmount: 877,
};

const money = (value: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const moneyThreeDecimals = (value: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);

const pad = (n: number) => String(n).padStart(2, '0');

// 09.11.2026
const issueDate = (value: Date) => {
  const d = new Date(value);

  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

// 10. 11. 2026 17:22:17
const printTime = (value: Date) =>
  `${pad(value.getDate())}. ${pad(value.getMonth() + 1)}. ${value.getFullYear()} ` +
  `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;

const toCents = (value: number) => Math.round(value * 100);

@Injectable()
export class PdfService {
  /**
   * Finds a font that is shipped with the api. Works for ts-node (src),
   * for the webpack build (dist) and when started from the project root.
   * Inter is used because the built in PDF fonts miss letters like č, ć, đ.
   */
  private fontPath(name: string) {
    const candidates = [
      path.join(__dirname, '..', 'fonts', name),
      path.join(__dirname, 'pdf', 'fonts', name),
      path.join(process.cwd(), 'src', 'pdf', 'fonts', name),
    ];
    const found = candidates.find((candidate) => existsSync(candidate));

    if (!found) {
      throw new Error(`Could not find PDF font ${name}`);
    }

    return found;
  }

  /**
   * Renders a proforma to a PDF, laid out like the "Predračun" of the accounting software
   * the company used before (A4, portrait). What the system does not know yet comes from
   * PROFORMA_PDF_MOCK, every mocked value has a TODO there.
   *
   * The prices of the drinks are prices WITH VAT, the VAT is calculated out of them.
   */
  renderProforma(data: ProformaPdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks: Buffer[] = [];
      const mock = PROFORMA_PDF_MOCK;
      const printedAt = new Date();
      let pageNumber = 1;

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('regular', this.fontPath('Inter-Regular.ttf'));
      doc.registerFont('bold', this.fontPath('Inter-Bold.ttf'));

      /**
       * Prints a text. x is the left edge, the right edge or the center (by align),
       * y is the vertical center of the text. Both are in picture pixels.
       */
      const text = (
        value: string,
        x: number,
        y: number,
        {
          align = 'left',
          size = 9,
          bold = false,
          underline = false,
        }: TextOptions = {},
      ) => {
        doc
          .font(bold ? 'bold' : 'regular')
          .fontSize(size)
          .fillColor('#000000')
          .strokeColor('#000000')
          .lineWidth(size * TEXT_WEIGHT);

        const width = doc.widthOfString(value);
        const left =
          align === 'left'
            ? pt(x)
            : align === 'right'
              ? pt(x) - width
              : pt(x) - width / 2;
        const top = pt(y) - size * 0.6;

        // fill and a hair of stroke together make the letters a little heavier, like the original
        doc.text(value, left, top, {
          lineBreak: false,
          underline,
          fill: true,
          stroke: true,
        });
      };

      const line = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        width = LINE_WIDTH,
      ) => {
        doc
          .lineWidth(width)
          .strokeColor('#000000')
          .moveTo(pt(x1), pt(y1))
          .lineTo(pt(x2), pt(y2))
          .stroke();
      };

      const footer = () => {
        text(mock.software, 52, FOOTER_Y, { size: 7 });
        text(mock.footerMarker, 273, FOOTER_Y, { size: 7 });
        text(printTime(printedAt), 482, FOOTER_Y, { size: 7, align: 'center' });
        text(`Strana ${pageNumber}`, 877, FOOTER_Y, {
          size: 7,
          align: 'right',
        });
      };

      // ---- the amounts -------------------------------------------------------------
      // the prices of the drinks are WITHOUT VAT, the VAT is added on top of them
      const vatFactor = 1 + VAT_RATE_PERCENT / 100;

      const rows = data.items.map((item, index) => {
        // the amount of the line before the discount ...
        const netBeforeCents = lineTotalCents(item.unitPrice, item.quantity);
        // ... and after it (the discount was already taken off lineTotal), then the VAT on top
        const netCents = toCents(item.lineTotal);
        const lineVatCents = vatCents(netCents);

        return {
          number: index + 1,
          code: item.code ?? '',
          name: item.name,
          quantity: item.quantity,
          netPrice: item.unitPrice,
          netBeforeCents,
          discountPercent: item.discountPercent,
          netCents,
          vatCents: lineVatCents,
          grossPrice: item.unitPrice * vatFactor,
          grossCents: netCents + lineVatCents,
        };
      });

      // "Vrednost robe" is the value before the discount, "Osnovica" the value after it
      const goodsTotalCents = rows.reduce(
        (sum, row) => sum + row.netBeforeCents,
        0,
      );
      const netTotalCents = rows.reduce((sum, row) => sum + row.netCents, 0);
      const vatTotalCents = rows.reduce((sum, row) => sum + row.vatCents, 0);
      const grossTotalCents = rows.reduce(
        (sum, row) => sum + row.grossCents,
        0,
      );

      // ---- the top of the first page ----------------------------------------------
      const header = () => {
        text(data.seller.name, 48, 63, { size: 12 });
        text(data.seller.street, 48, 87, { size: 10 });
        text(data.seller.city, 48, 107, { size: 10 });
        text(`PIB: ${data.seller.pib}`, 48, 125, { size: 10 });
        text(`MB: ${data.seller.registrationNumber}`, 343, 125, { size: 10 });
        text(`TEL: ${data.seller.phone ?? ''}`, 48, 145, { size: 10 });
        text(`Tekući račun: ${data.seller.bankAccount}`, 48, 210, {
          size: 10,
        });
        // two spaces before the number, like the original
        text(
          `PRILIKOM UPLATE POZVATI SE NA BROJ:  ${data.documentNumber}`,
          48,
          307,
          { size: 10.3 },
        );

        // the box of the buyer, its top border is interrupted by the title.
        // The lines of the box are thinner than the lines of the table.
        const box = (x1: number, y1: number, x2: number, y2: number) =>
          line(x1, y1, x2, y2, BOX_LINE_WIDTH);

        // the title sits on the top border, the frame of the name is a bit below it
        box(574, 58, 582, 58);
        text('Kupac:', 597, 58, { size: 9, underline: true });
        box(650, 58, 877, 58);
        box(574, 58, 574, 321);
        box(877, 58, 877, 321);
        box(574, 321, 877, 321);
        // the frame around the name of the buyer
        box(582, 71, 867, 71);
        box(867, 71, 867, 130);
        box(582, 71, 582, 130);
        if (data.customerName) {
          text(data.customerName, 588, 103, { size: 9.4 });
        }

        text(`Predracun -  ${data.documentNumber}`, 463, 342, {
          size: 14.8,
          align: 'center',
        });
        text(
          `SKLADIŠTE : ${data.warehouseId} - ${data.warehouseName.toUpperCase()}`,
          48,
          377,
          { size: 8.2 },
        );
        text(`Mesto izdavanja računa : ${data.seller.city}`, 371, 377, {
          size: 7.8,
        });
        text(
          `Datum izdavanja predračuna : ${issueDate(data.createdAt)}`,
          48,
          396,
          { size: 7.8 },
        );
      };

      // ---- the table ----------------------------------------------------------------
      // top: the vertical start of the blue band (picture pixels)
      const tableHeader = (top: number) => {
        doc
          .rect(
            pt(TABLE_LEFT),
            pt(top),
            pt(TABLE_RIGHT - TABLE_LEFT),
            pt(BAND_HEIGHT),
          )
          .fill('#BCD6FF');

        const upper = top + 8.7;
        const lower = top + 23.7;
        const label = (
          value: string,
          x: number,
          y: number,
          align: TextOptions['align'],
        ) => text(value, x, y, { size: 8, align });

        label('RBR', 50, lower, 'left');
        label('ŠIFRA', 114, lower, 'right');
        label('NAZIV ARTIKLA', COLUMN.name, lower, 'left');
        label('JM', COLUMN.unit, lower, 'center');
        label('KOL.', COLUMN.quantity, lower, 'right');
        label('CENA', COLUMN.price, lower, 'right');
        label('IZNOS', COLUMN.amount, lower, 'right');
        label('RAB%', 561, lower, 'right');
        label('IZNOS', COLUMN.netAmount, upper, 'right');
        label('BEZ PDV', COLUMN.netAmount, lower, 'right');
        label('P', 676, lower, 'center');
        label('PDV', COLUMN.vat, lower, 'right');
        label('CENA', 791, upper, 'right');
        label('SA PDV', 791, lower, 'right');
        label('IZNOS', COLUMN.grossAmount, upper, 'right');
        label('SA PDV', COLUMN.grossAmount, lower, 'right');
      };

      const tableRow = (row: (typeof rows)[number], y: number) => {
        const size = 6.8;
        const right = (value: string, x: number) =>
          text(value, x, y, { size, align: 'right' });

        text(String(row.number), COLUMN.rowNumber, y, {
          size,
          align: 'center',
        });
        right(row.code, COLUMN.code);
        // the names of the articles are printed in capital letters
        text(row.name.toUpperCase(), COLUMN.name, y, { size });
        text(mock.unitOfMeasure, COLUMN.unit, y, { size, align: 'center' });
        right(row.quantity.toFixed(2), COLUMN.quantity);
        right(moneyThreeDecimals(row.netPrice), COLUMN.price);
        right(money(row.netBeforeCents / 100), COLUMN.amount);
        right(row.discountPercent.toFixed(2), COLUMN.discount);
        right(money(row.netCents / 100), COLUMN.netAmount);
        right(`${VAT_RATE_PERCENT.toFixed(1)}%`, COLUMN.vatRate);
        right(money(row.vatCents / 100), COLUMN.vat);
        right(moneyThreeDecimals(row.grossPrice), COLUMN.grossPrice);
        right(money(row.grossCents / 100), COLUMN.grossAmount);
      };

      // ---- the totals, signatures --------------------------------------------------
      // base: the vertical position of the line under the last row
      const summary = (base: number) => {
        const labelRight = 786;
        const label = { size: 9.4, align: 'right' } as const;
        const value = { size: 7.7, align: 'right' } as const;

        text(`Težina: ${mock.weightKg.toFixed(1)} Kg`, 279, base + 24.3, {
          size: 7.7,
        });

        text('Vrednost robe:', labelRight, base + 12.2, label);
        text(money(goodsTotalCents / 100), TABLE_RIGHT, base + 12.2, value);
        text('Iznos rabata:', labelRight, base + 32.2, label);
        text(
          money((goodsTotalCents - netTotalCents) / 100),
          TABLE_RIGHT,
          base + 32.2,
          value,
        );

        text(
          `Osnovica za PDV ${VAT_RATE_PERCENT.toFixed(1)}%:`,
          604,
          base + 52.9,
          {
            size: 9.8,
            align: 'right',
          },
        );
        text(money(netTotalCents / 100), 607, base + 52.9, { size: 7.7 });
        text('PDV:', labelRight, base + 52.9, label);
        text(money(vatTotalCents / 100), TABLE_RIGHT, base + 52.9, value);

        line(417, base + 63.5, TABLE_RIGHT, base + 63.5);
        text('Za placanje:', labelRight, base + 78.5, label);
        text(money(grossTotalCents / 100), TABLE_RIGHT, base + 78.5, value);

        text(
          `SLOVIMA: ${amountInWords(grossTotalCents / 100)}`,
          48,
          base + 109.3,
          { size: 7.6 },
        );

        const labels = base + 143.7;
        const lines = base + 184.8;
        const names = base + 197.3;
        const signature = { size: 7.7, align: 'center' } as const;

        text('Robu fakturisao :', 128, labels, signature);
        text('Robu izdao :', 350, labels, signature);
        text('Vozač (ime, prezime, br.lk)', 580, labels, signature);
        text('Robu preuzeo :', 804, labels, signature);

        line(55, lines, 201, lines);
        line(277, lines, 423, lines);
        line(499, lines, 662, lines);
        line(731, lines, 877, lines);

        text(data.createdByName, 128, names, signature);
        text('Reg.br.vozila', 499, names, { size: 7.7 });
        text('Datum:', 731, names, { size: 7.7 });
      };

      // ---- put it together ----------------------------------------------------------
      header();
      tableHeader(BAND_TOP);

      let y = FIRST_ROW_Y;

      for (const row of rows) {
        // a new page when the next row would not fit
        if (y > ROWS_BOTTOM_LIMIT) {
          footer();
          doc.addPage();
          pageNumber += 1;
          tableHeader(CONTINUED_TABLE_TOP);
          y = CONTINUED_TABLE_TOP + (FIRST_ROW_Y - BAND_TOP);
        }

        tableRow(row, y);
        y += ROW_HEIGHT;
      }

      // the line under the last row
      let base = y - ROW_HEIGHT + 9.5;

      // the totals need their own space, otherwise they go to a new page
      if (base + SUMMARY_HEIGHT > FOOTER_Y - 15) {
        footer();
        doc.addPage();
        pageNumber += 1;
        base = CONTINUED_TABLE_TOP;
      }

      line(TABLE_LEFT, base, TABLE_RIGHT, base);
      summary(base);
      footer();

      doc.end();
    });
  }
}
