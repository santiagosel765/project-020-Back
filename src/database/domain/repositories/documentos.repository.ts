import { Prisma } from 'generated/prisma';

export const DOCUMENTOS_REPOSITORY = 'DOCUMENTOS_REPOSITORY';

export abstract class DocumentosRepository {
  abstract updateDocumentoByCuadroFirmaID(
    cuadroFirmaID: number,
    data: {
      [key: string]: any;
    },
  ): Promise<Prisma.BatchPayload>;

  abstract findByCuadroFirmaID(
    cuadroFirmaID: number,
  ): Promise<{ id:number, nombre_archivo: string | null, resumen: string | null } | null>;

  abstract updateDocumento(documentoId: number, data: {
    [key: string]: any;
})
}
