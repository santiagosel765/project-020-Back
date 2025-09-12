import { FirmanteUserDto } from "../dto/create-cuadro-firma.dto";

  export function generarFilasFirmas(
    firmantes: FirmanteUserDto[] | undefined,
    tipo: 'APRUEBA' | 'REVISA',
    labelPrimeraFila: string,
  ): string {
    if (!firmantes) return '';

    return firmantes
      .map((f, index) => {
        const rowLabel = index === 0 ? labelPrimeraFila : '';
        return `<tr class="tr-firmas">
        <td class="row-label">${rowLabel}</td>
        <td>FIRMANTE_${tipo}</td>
        <td>PUESTO_${tipo}</td>
        <td>GERENCIA_${tipo}</td>
        <td class="td-firma"></td>
        <td>FECHA_${tipo}_${f.nombre.replaceAll(' ', '_')}</td>
      </tr>`
          .replace(`FIRMANTE_${tipo}`, f.nombre)
          .replace(`PUESTO_${tipo}`, f.puesto)
          .replace(`GERENCIA_${tipo}`, f.gerencia);
      })
      .join('');
  }