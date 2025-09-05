// @ts-ignore
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
// @ts-ignore
const pdfjsWorker = require('pdfjs-dist/legacy/build/pdf.worker.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = require('pdfjs-dist/build/pdf.worker.entry');

/**
 * Busca las coordenadas (x, y) de un placeholder de texto dentro de un PDF.
 *
 * Esta función recorre todas las páginas del PDF y examina los items de texto extraídos por PDF.js.
 * Permite encontrar placeholders que estén divididos en varios items consecutivos (por ejemplo, "PRIMERA_FIRMA" como ["PRIMERA", "_FIRMA"]).
 *
 * @param pdfBuffer - Buffer del archivo PDF a analizar.
 * @param placeholder - Texto del placeholder a buscar.
 * @returns Un objeto con la página (base 0), coordenada x y coordenada y del primer carácter del placeholder, o null si no se encuentra.
 *
 * @throws Error si ocurre algún problema al procesar el PDF.
 */
export async function findPlaceholderCoordinates(
  pdfBuffer: Buffer,
  placeholder: string,
): Promise<{ page: number; x: number; y: number } | null> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
    });
    const pdf = await loadingTask.promise;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items;

      // Recorre los items buscando secuencias que formen el placeholder
      for (let i = 0; i < items.length; i++) {
        let combined = '';
        let startIdx = i;
        let endIdx = i;
        while (
          endIdx < items.length &&
          typeof items[endIdx].str === 'string' &&
          combined.length < placeholder.length
        ) {
          combined += items[endIdx].str;
          if (combined === placeholder) {
            // Devuelve la posición del primer item de la secuencia
            return {
              page: pageNum - 1,
              x: items[startIdx].transform[4],
              y: items[startIdx].transform[5],
            };
          }
          endIdx++;
        }
      }
    }
    return null;
  } catch (error) {
    throw new Error(
      `Problemas al encontrar coordinadas del placeholder: ${placeholder}: ${error}`,
    );
  }
}

