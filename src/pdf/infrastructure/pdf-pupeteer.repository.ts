import puppeteer, { LaunchOptions } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { PdfGenerationRepository } from '../domain/repositories/pdf-generation.repository';
import { Logger } from '@nestjs/common';

export class PDFPuppeteerRepository implements PdfGenerationRepository {
  private logger = new Logger(PDFPuppeteerRepository.name);

  async generatePDFFromHTML(htmlContent: string): Promise<{ outputPath: string; fileName: string }> {
    const ts = Date.now().toString();
    const tmpFolder = path.join(process.cwd(), 'tmp', 'files');
    const chromeProfile = path.join(process.cwd(), 'tmp', 'chrome-profile');
    fs.mkdirSync(tmpFolder, { recursive: true });
    fs.mkdirSync(chromeProfile, { recursive: true });

    const fileName = `CUADRO_FIRMAS_${ts}`;
    const outputPath = path.join(tmpFolder, `${fileName}.pdf`);

    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    this.logger.log(`Chrome: ${executablePath ?? 'binario de Puppeteer'}`);

    const launchOptions: LaunchOptions = {
      headless: true,
      executablePath: executablePath || undefined,
      userDataDir: chromeProfile,
      timeout: 60000,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--disable-extensions',
      ],
    };

    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
    try {
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.pdf({ path: outputPath, format: 'A4', printBackground: true });

      if (!fs.existsSync(outputPath)) throw new Error(`No se generó el PDF en: ${outputPath}`);

      this.logger.log('Archivo PDF generado exitosamente');
      return { outputPath, fileName };
    } catch (error) {
      const errMsg = `No se ha podido generar archivo PDF, error: ${error}`;
      this.logger.error(errMsg);
      throw new Error(errMsg);
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  replacePlaceholders(htmlContent: string, placeholders: Record<string, string>) {
    let html = htmlContent;
    for (const [k, v] of Object.entries(placeholders)) html = html.replaceAll(k, v);
    return html;
  }
}

