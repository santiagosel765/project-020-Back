import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResponsablesFirmaDto } from '../dto/create-cuadro-firma.dto';
import { parseResponsables } from '../utils/parse-responsables.util';

@Injectable()
export class ResponsablesNormalizerPipe implements PipeTransform {
  constructor(private readonly prisma: PrismaService) {}

  private toArray(v: any) {
    return Array.isArray(v) ? v : v ? [v] : [];
  }

  async transform(value: any): Promise<ResponsablesFirmaDto> {
    const raw = parseResponsables(value) ?? {};

    const upper = {
      ELABORA: raw.ELABORA ?? raw.elabora,
      REVISA: raw.REVISA ?? raw.revisa,
      APRUEBA: raw.APRUEBA ?? raw.aprueba,
    } as any;

    const responsabilidades = await this.prisma.responsabilidad_firma.findMany({
      select: { id: true, nombre: true },
    });
    const respMap = new Map<string, number>();
    responsabilidades.forEach((r) => {
      respMap.set((r.nombre ?? '').toUpperCase(), r.id);
    });

    const mapFirmante = (f: any, role: string) => {
      const responsabilidadId = f.responsabilidadId ?? respMap.get(role);
      if (!responsabilidadId) {
        throw new BadRequestException(`Responsabilidad \\"${role}\\" inválida`);
      }
      const userId = +(f.userId ?? f.idUser);
      if (!userId) {
        throw new BadRequestException(`userId inválido en ${role}`);
      }
      return {
        userId,
        nombre: f.nombre ?? '',
        puesto: f.puesto ?? '',
        gerencia: f.gerencia ?? '',
        responsabilidadId,
      };
    };

    const result: ResponsablesFirmaDto = {
      elabora: this.toArray(upper.ELABORA)[0]
        ? mapFirmante(this.toArray(upper.ELABORA)[0], 'ELABORA')
        : undefined,
      revisa: this.toArray(upper.REVISA).map((f: any) =>
        mapFirmante(f, 'REVISA'),
      ),
      aprueba: this.toArray(upper.APRUEBA).map((f: any) =>
        mapFirmante(f, 'APRUEBA'),
      ),
    };

    return result;
  }
}
