import { PDFDocument } from 'pdf-lib';

export async function convertDocument(file: File, toFormat: string): Promise<{ url: string, output: string }> {
  const buffer = await file.arrayBuffer();
  let result: ArrayBuffer;
  const fileName = file.name.split('.')[0];

  switch (toFormat) {
    case 'pdf': {
      if (file.name.endsWith('.txt')) {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const text = await file.text();
        
        page.drawText(text, {
          x: 50,
          y: page.getHeight() - 50,
          size: 12,
          maxWidth: page.getWidth() - 100,
        });
        
        result = await pdfDoc.save();
      } else {
        throw new Error('Unsupported conversion to PDF');
      }
      break;
    }
    
    case 'txt': {
      if (file.name.endsWith('.pdf')) {
        const pdfDoc = await PDFDocument.load(buffer);
        const pages = pdfDoc.getPages();
        let text = '';
        
        for (const page of pages) {
          const textContent = await page.getTextContent();
          text += textContent + '\n';
        }
        
        result = new TextEncoder().encode(text);
      } else {
        throw new Error('Unsupported conversion to TXT');
      }
      break;
    }
    
    default:
      throw new Error('Unsupported format');
  }

  const url = URL.createObjectURL(new Blob([result]));
  const output = `${fileName}.${toFormat}`;

  return { url, output };
} 