import { Module } from '@nestjs/common';
import { AwsModule } from 'src/aws/aws.module';
import { PdfModule } from 'src/pdf/pdf.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CUADRO_FIRMAS_REPOSITORY } from './domain/repositories/cuadro-firmas.repository';
import { PrismaCuadroFirmaRepository } from './infrastructure/prisma-cuadro-firmas.repository';
import { DOCUMENTOS_REPOSITORY } from './domain/repositories/documentos.repository';
import { PrismaDocumentosRepository } from './infrastructure/pirsma-documentos.repository';
import { NOTIFICACIONES_REPOSITORY } from './domain/repositories/notificaciones.repository';
import { PrismaNotificacioensRepository } from './infrastructure/prisma-notificaciones.repository';

@Module({
  imports: [PdfModule, PrismaModule, AwsModule],
  providers: [
    {
      provide: CUADRO_FIRMAS_REPOSITORY,
      useClass: PrismaCuadroFirmaRepository,
    },
    {
      provide: DOCUMENTOS_REPOSITORY,
      useClass: PrismaDocumentosRepository,
    },
    {
      provide: NOTIFICACIONES_REPOSITORY,
      useClass: PrismaNotificacioensRepository,
    },
    PrismaCuadroFirmaRepository,
    PrismaDocumentosRepository,
    PrismaNotificacioensRepository
  ],
  exports: [CUADRO_FIRMAS_REPOSITORY, DOCUMENTOS_REPOSITORY, NOTIFICACIONES_REPOSITORY],
})
export class DatabaseModule {}
