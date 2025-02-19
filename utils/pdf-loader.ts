import { GlobalWorkerOptions } from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min';

// Explicitly set the worker version
const PDFJS_VERSION = '3.11.174';  // Match this with your pdfjs-dist version

// Set the worker source path
GlobalWorkerOptions.workerSrc = worker; 