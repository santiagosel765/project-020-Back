// @ts-ignore
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
// @ts-ignore
const pdfjsWorker = require('pdfjs-dist/legacy/build/pdf.worker.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = require('pdfjs-dist/build/pdf.worker.entry');

/**
 * Extrae el texto de todas las páginas de un PDF.
 *
 * Utiliza PDF.js para procesar el buffer del PDF y concatenar el texto de cada página.
 * El resultado incluye saltos de línea y un encabezado por página.
 *
 * @param pdfBuffer - Buffer del archivo PDF a analizar.
 * @returns Una promesa que resuelve con el texto extraído de todo el PDF, incluyendo separadores por página.
 *
 * @throws Error si ocurre algún problema al procesar el PDF.
 */
export const pdfExtractText = async ( pdfBuffer: Buffer ): Promise<string> => {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
    const pdf = await loadingTask.promise;

    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str).join(' ');
      text += `\n\nPage ${i}: ${strings}`;
    }

    return text;
}