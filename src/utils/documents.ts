import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import type { DocumentResult } from '../types';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Extract text from PDF
export const extractPdfText = async (file: File): Promise<DocumentResult> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map(item => ('str' in item ? item.str : ''))
      .join(' ');
    fullText += `\n--- Page ${i} ---\n${pageText}`;
  }
  
  return {
    text: fullText.trim(),
    pageCount: pdf.numPages,
    type: 'pdf'
  };
};

// Extract text from Word document (.docx)
export const extractWordText = async (file: File): Promise<DocumentResult> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return {
    text: result.value,
    type: 'word',
    messages: result.messages
  };
};

// Extract data from Excel files
export const extractExcelText = async (file: File): Promise<DocumentResult> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  let fullText = '';
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    fullText += `\n--- Sheet: ${sheetName} ---\n${csv}`;
  });
  
  return {
    text: fullText.trim(),
    sheetCount: workbook.SheetNames.length,
    sheetNames: workbook.SheetNames,
    type: 'excel'
  };
};

// Get file extension helper
const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return filename;
  return filename.slice(lastDot).toLowerCase();
};

// Process document based on type
export const processDocument = async (file: File): Promise<DocumentResult> => {
  const ext = getFileExtension(file.name);
  
  try {
    if (ext === '.pdf') {
      return await extractPdfText(file);
    } else if (ext === '.docx' || ext === '.doc') {
      return await extractWordText(file);
    } else if (ext === '.xlsx' || ext === '.xls') {
      return await extractExcelText(file);
    }
    throw new Error(`Unsupported document type: ${ext}`);
  } catch (error) {
    console.error(`Error processing ${file.name}:`, error);
    throw new Error(`Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
