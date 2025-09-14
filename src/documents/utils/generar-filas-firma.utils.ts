import { FirmanteUserDto } from "../dto/create-cuadro-firma.dto";

function htmlEscape(s: string): string {
  // Evita inyectar HTML en nombres/puestos/gerencias
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeSlug(nombre?: string, fallback = "SIN_NOMBRE"): string {
  const n = (nombre ?? "").trim();
  return n ? n.replace(/\s+/g, "_") : fallback;
}

export function generarFilasFirmas(
  firmantes: FirmanteUserDto[] | undefined,
  tipo: "APRUEBA" | "REVISA",
  labelPrimeraFila: string,
): string {
  if (!Array.isArray(firmantes) || firmantes.length === 0) return "";

  return firmantes
    .map((f, index) => {
      const rowLabel = index === 0 ? labelPrimeraFila : "";
      const nombre = (f?.nombre ?? "").trim();
      const puesto = f?.puesto ?? "";
      const gerencia = f?.gerencia ?? "";

      // Este slug se usa en el placeholder de FECHA para firmar luego:
      // debe coincidir con la lógica del "sign" (nombre con _)
      const slug = safeSlug(nombre, tipo);

      return `
<tr class="tr-firmas">
  <td class="row-label">${htmlEscape(rowLabel)}</td>
  <td>${htmlEscape(nombre)}</td>
  <td>${htmlEscape(puesto)}</td>
  <td>${htmlEscape(gerencia)}</td>
  <td class="td-firma"></td>
  <td>FECHA_${tipo}_${slug}</td>
</tr>`.trim();
    })
    .join("");
}
