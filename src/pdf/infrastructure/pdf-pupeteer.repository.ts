import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

import { PdfGenerationRepository } from "../domain/repositories/pdf-generation.repository";
import { Logger } from '@nestjs/common';

export class PDFPuppeteerRepository implements PdfGenerationRepository {
    

    logger: Logger = new Logger("PDFPuppeteerRepository");

    async generatePDFFromHTML(htmlContent: string): Promise<{outputPath: string, fileName: string}> {
        const timestamp: number = Date.now();
        const timestampString: string = timestamp.toString();
        const tmpFolder = path.join(process.cwd(), 'tmp/files');
        const fileName= `CUADRO_FIRMAS_${timestampString}`
        const outputPath = `${tmpFolder}/${fileName}.pdf`

        try {
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            await page.setContent(htmlContent);
            await page.pdf({ path: outputPath, format: 'A4', printBackground: true });
            await browser.close();

            if(!fs.existsSync(outputPath)) {
                throw new Error(`No se ha podido generar archivo PDF en ruta: ${outputPath}`);
            }
            
            this.logger.log('Archivo PDF generado exitosamente')
            return {
                outputPath,
                fileName
            };
            
        } catch (error) {
            const errMsg = `No se ha podido generar archivo PDF, error: ${error}`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }

    }

    replacePlaceholders(htmlContent: string, placeholders: { [key: string]: string }): string {
        let htmlResult = htmlContent;
        for( const [key, value] of Object.entries(placeholders) ) {
            htmlResult = htmlResult.replaceAll( key, value );
        }

        return htmlResult;
    }

}