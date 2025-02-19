import { PDFDocument } from 'pdf-lib';
import mammoth from 'mammoth';
import * as docx from 'docx';
import * as pdfjsLib from 'pdfjs-dist';
import './pdf-loader';  // Import PDF.js worker initialization

export default async function convertDocument(file: File, toFormat: string): Promise<{ url: string, output: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    let result: ArrayBuffer | string;
    let output = file.name.substring(0, file.name.lastIndexOf('.')) + '.' + toFormat;
    let mimeType: string;

    switch (toFormat.toLowerCase()) {
      case 'pdf':
        const pdfDoc = await PDFDocument.create();
        if (file.type.includes('text/plain')) {
          // Convert TXT to PDF
          const text = new TextDecoder().decode(arrayBuffer);
          const page = pdfDoc.addPage();
          page.drawText(text, { x: 50, y: page.getHeight() - 50 });
        } else if (file.type.includes('docx')) {
          // Convert DOCX to PDF
          const { value } = await mammoth.extractRawText({ arrayBuffer });
          const page = pdfDoc.addPage();
          page.drawText(value, { x: 50, y: page.getHeight() - 50 });
        }
        const pdfBytes = await pdfDoc.save();
        result = pdfBytes.buffer;
        mimeType = 'application/pdf';
        break;

      case 'docx':
        let content = "";
        if (file.type.includes('text/plain')) {
          content = new TextDecoder().decode(arrayBuffer);
        } else if (file.type.includes('pdf')) {
          // Extrahovat text z PDF pomocí pdf.js
          const loadingTask = pdfjsLib.getDocument(new Uint8Array(arrayBuffer));
          const pdf = await loadingTask.promise;
          const textContent = [];
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const text = await page.getTextContent();
            const pageText = text.items
              .map((item: any) => item.str)
              .join(' ');
            textContent.push(pageText);
          }
          
          content = textContent.join('\n\n');
        }
        
        // Vytvořit DOCX s extrahovaným obsahem
        const doc = new docx.Document({
          sections: [{
            properties: {},
            children: content.split('\n').map(paragraph => 
              new docx.Paragraph({
                children: [new docx.TextRun(paragraph)],
                spacing: {
                  after: 200
                }
              })
            ),
          }],
        });
        
        result = await docx.Packer.toBuffer(doc);
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;

      case 'txt':
        if (file.type.includes('pdf')) {
          // Extrahovat text z PDF
          const loadingTask = pdfjsLib.getDocument(new Uint8Array(arrayBuffer));
          const pdf = await loadingTask.promise;
          const textContent = [];
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const text = await page.getTextContent();
            const pageText = text.items
              .map((item: any) => item.str)
              .join(' ');
            textContent.push(pageText);
          }
          
          result = textContent.join('\n\n');
        } else if (file.type.includes('docx')) {
          const { value } = await mammoth.extractRawText({ arrayBuffer });
          result = value;
        } else {
          throw new Error('Unsupported conversion to TXT');
        }
        mimeType = 'text/plain';
        break;

      default:
        throw new Error(`Unsupported format: ${toFormat}`);
    }

    const blob = new Blob([result], { type: mimeType });
    const url = URL.createObjectURL(blob);

    return { url, output };
  } catch (error: unknown) {
    console.error('Document conversion error:', error);
    
    // Safely handle the error message
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Unknown error occurred during conversion";
      
    throw new Error(`Failed to convert document: ${errorMessage}`);
  }
} 