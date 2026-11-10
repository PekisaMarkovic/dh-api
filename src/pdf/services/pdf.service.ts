import { Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import * as path from 'path';
// pdfkit is a CommonJS `export =` module and this project has no esModuleInterop,
// so a default import would be undefined at runtime
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PDFDocument = require('pdfkit');

export type ProformaPdfData = {
  number: string;
  createdAt: Date;
  warehouseName: string;
  createdByName: string;
  total: number;
  status: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
};

const money = (value: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const date = (value: Date) => {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
};

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
   * Renders a proforma to a PDF.
   * PLACEHOLDER LAYOUT: it only prints everything that is on the proforma,
   * the final design of the document comes later and belongs in this method.
   */
  renderProforma(data: ProformaPdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('regular', this.fontPath('Inter-Regular.ttf'));
      doc.registerFont('bold', this.fontPath('Inter-Bold.ttf'));

      doc.font('bold').fontSize(20).text(`Proforma ${data.number}`);
      doc
        .font('regular')
        .fontSize(10)
        .fillColor('#64748B')
        .text('Placeholder text - the final design of this document is coming.')
        .fillColor('#000000')
        .moveDown();

      doc.fontSize(11);
      doc.text(`Date: ${date(data.createdAt)}`);
      doc.text(`Warehouse: ${data.warehouseName}`);
      doc.text(`Created by: ${data.createdByName}`);
      doc.text(
        `Status: ${data.status === 'returned' ? 'Returned to stock' : 'Active'}`,
      );
      doc.moveDown();

      // simple table: name | quantity | price per unit | total
      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const columns = { name: left, quantity: 300, price: 370, total: 460 };
      const widths = { quantity: 60, price: 80, total: right - 460 };

      const row = (
        y: number,
        cells: [string, string, string, string],
        bold = false,
      ) => {
        doc.font(bold ? 'bold' : 'regular').fontSize(10);
        doc.text(cells[0], columns.name, y, { width: 220, lineBreak: false });
        doc.text(cells[1], columns.quantity, y, {
          width: widths.quantity,
          align: 'right',
        });
        doc.text(cells[2], columns.price, y, {
          width: widths.price,
          align: 'right',
        });
        doc.text(cells[3], columns.total, y, {
          width: widths.total,
          align: 'right',
        });
      };

      row(doc.y, ['Drink', 'Quantity', 'Price per unit', 'Total'], true);
      doc
        .moveTo(left, doc.y + 4)
        .lineTo(right, doc.y + 4)
        .strokeColor('#CBD5E1')
        .stroke();
      doc.y += 10;

      for (const item of data.items) {
        // a new page when the next row would not fit above the bottom margin
        if (doc.y > doc.page.height - doc.page.margins.bottom - 60) {
          doc.addPage();
        }

        row(doc.y, [
          item.name,
          String(item.quantity),
          money(item.unitPrice),
          money(item.lineTotal),
        ]);
        doc.y += 6;
      }

      doc
        .moveTo(left, doc.y + 2)
        .lineTo(right, doc.y + 2)
        .strokeColor('#CBD5E1')
        .stroke();
      doc.y += 10;
      row(doc.y, ['Total', '', '', money(data.total)], true);

      doc.end();
    });
  }
}
