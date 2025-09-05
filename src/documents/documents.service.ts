import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { PDF_REPOSITORY } from '../pdf/domain/repositories/pdf.repository';
import type { PdfRepository } from '../pdf/domain/repositories/pdf.repository';
import fs from 'fs';
import path from 'path';
import { SignDocumentDto } from './dto/sign-document.dto';
import { AiService } from 'src/ai/ai.service';

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(PDF_REPOSITORY)
    private readonly pdfRepository: PdfRepository,
    private readonly aiService: AiService,
  ) {}

  create(createDocumentDto: CreateDocumentDto) {
    return 'This action adds a new document';
  }

  async signDocumentTest(
    pdfBuffer: Buffer,
    signatureBuffer: Buffer,
  ): Promise<Buffer | null> {
    // ? Placeholder 'FIRMA_DIGITAL' por defecto
    const signedPdfBuffer = await this.pdfRepository.insertSignature(
      pdfBuffer,
      signatureBuffer,
      null as any,
    );
    const timestamp: number = Date.now();
    const timestampString: string = timestamp.toString();
    try {
      const testFolder = path.join(process.cwd(), 'tmp/files');
      if (!fs.existsSync(testFolder))
        fs.mkdirSync(testFolder, { recursive: true });

      if (signedPdfBuffer)
        fs.writeFileSync(`tmp/files/${timestampString}.pdf`, signedPdfBuffer);
    } catch (error) {
      throw new HttpException(
        `Problemas al generar archivo de salida: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return signedPdfBuffer;
  }

  async multipleSignDocumentTest(signDocumentDto: SignDocumentDto) {
    const { signatures, pdfBuffer } = signDocumentDto;

    try {
      const signedPdfBuffer = await this.pdfRepository.insertMultipleSignature(
        pdfBuffer,
        signatures,
        null as any,
      );
      const timestamp: number = Date.now();
      const timestampString: string = timestamp.toString();
      const testFolder = path.join(process.cwd(), 'tmp/files');
      if (!fs.existsSync(testFolder))
        fs.mkdirSync(testFolder, { recursive: true });

      if (signedPdfBuffer)
        fs.writeFileSync(`tmp/files/${timestampString}.pdf`, signedPdfBuffer);
    } catch (error) {
      throw new HttpException(
        `Problemas al generar archivo de salida: ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async analyzePDFTest( pdfBuffer: Buffer ) {
    return this.pdfRepository.extractText( pdfBuffer )
  }

  findOne(id: number) {
    return `This action returns a #${id} document`;
  }

  update(id: number, updateDocumentDto: UpdateDocumentDto) {
    return `This action updates a #${id} document`;
  }

  remove(id: number) {
    return `This action removes a #${id} document`;
  }
}
