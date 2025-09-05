import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import {
  FileFieldsInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { SignDocumentDto } from './dto/sign-document.dto';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  create(@Body() createDocumentDto: CreateDocumentDto) {
    return this.documentsService.create(createDocumentDto);
  }

  @Post('sign-test')
  @UseInterceptors(FilesInterceptor('files', 2))
  signDocumentTest(@UploadedFiles() files: Express.Multer.File[]) {
    const [pdfFile, signatureFile] = files;
    return this.documentsService.signDocumentTest(
      pdfFile.buffer,
      signatureFile.buffer,
    );
  }

  @Post('analyze-pdf-test')
  @UseInterceptors(FilesInterceptor('files', 1))
  analyzePDFTest(@UploadedFiles() files: Express.Multer.File[]) {
    return this.documentsService.analyzePDFTest(
      files[0].buffer,
    );
  }

  /**
   * Recibe un PDF y múltiples firmas (imágenes), junto con la relación de cada firma con su placeholder.
   *
   * El cliente debe enviar:
   * - Un archivo PDF en el campo 'pdf'.
   * - Uno o más archivos de firma en el campo 'signatures'.
   * - Un campo de texto 'signaturesMeta' que contenga un JSON con la relación entre los archivos de firma y los placeholders.
   *
   * El campo 'signaturesMeta' debe ser un arreglo de objetos con la forma:
   * [
   *   { "fileIndex": 0, "placeholder": "placeholder_1" },
   *   { "fileIndex": 0, "placeholder": "placeholder_2" },
   *   { "fileIndex": 1, "placeholder": "placeholder_3" }
   * ]
   * Donde 'fileIndex' es el índice del archivo de firma en el arreglo 'signatures', y 'placeholder' es el nombre del placeholder en el PDF.
   *
   * Esto permite reutilizar una misma firma en varios placeholders.
   *
   * @param files Archivos subidos: PDF y firmas.
   * @param signaturesMeta JSON string que indica la relación entre firmas y placeholders.
   * @returns El resultado del servicio de firmado múltiple.
   */
  @Post('multiple-sign-test')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'pdf', maxCount: 1 },
      { name: 'signatures', maxCount: 10 },
    ]),
  )
  multipeSignTest(
    @UploadedFiles()
    files: {
      pdf: Express.Multer.File[];
      signatures: Express.Multer.File[];
    },
    @Body('signaturesMeta') signaturesMeta: string,
  ) {
    const pdfFile = files.pdf[0];
    const signatureFiles = files.signatures || [];

    let meta: { fileIndex: number; placeholder: string }[] = [];
    try {
      meta = JSON.parse(signaturesMeta);
    } catch (e) {
      throw new Error('signaturesMeta debe ser un JSON válido');
    }

    // ? Empatar placeholders con firmas
    const signatures = meta.map((item) => ({
      signature: signatureFiles[item.fileIndex]?.buffer,
      placeholder: item.placeholder,
    }));

    const dto: SignDocumentDto = {
      pdfBuffer: pdfFile.buffer,
      signatures,
    };

    return this.documentsService.multipleSignDocumentTest(dto);
  }


  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(+id, updateDocumentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentsService.remove(+id);
  }
}



