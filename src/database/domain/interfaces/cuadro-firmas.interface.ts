export interface GenerarCuadroFirmasResult {
  pdfContent: Buffer;
  plantilladId: number;
  formattedHtml: string;
  fileName: string;
}

export interface UpdateCuadroFirmasResult {
  titulo: string;
  descripcion: string | null;
  version: string | null;
  codigo: string | null;
  pdf: Uint8Array | null;
  pdf_html: string | null;
  nombre_pdf: string | null;
  url_pdf: string | null;
  add_date: Date | null;
  updated_at: Date | null;
  id: number;
  empresa_id: number | null;
  created_by: number | null;
  estado_firma_id: number | null;
  plantilla_id: number | null;
}

export interface DocumentoCuadroFirmaUser {
  id: number;
  primer_nombre: string;
  segundo_name: string | null;
  tercer_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  apellido_casada: string | null;
  correo_institucional: string;
}

export interface DocumentoCuadroFirma {
  add_date: Date | null;
  updated_at: Date | null;
  nombre_archivo: string;
  user: DocumentoCuadroFirmaUser | null;
}

export interface UsuarioFirmanteResponsabilidad {
  id: number;
  nombre: string;
}

export interface UsuarioFirmante {
  id: number;
  correo_institucional: string;
  primer_nombre: string;
  segundo_name: string | null;
  tercer_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  apellido_casada: string | null;
}

export interface UsuarioFirmanteCuadroFirma {
  estaFirmado: boolean | null;
  responsabilidad_firma: UsuarioFirmanteResponsabilidad | null;
  user: UsuarioFirmante;
}

export interface HistorialCuadroFirmaUser {
  id: number;
  correo_institucional: string;
  primer_nombre: string;
  segundo_name: string | null;
  tercer_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  apellido_casada: string | null;
}

export interface HistorialCuadroFirmaEstado {
  id: number;
  nombre: string;
}

export interface HistorialCuadroFirma {
  user: HistorialCuadroFirmaUser;
  estado_firma: HistorialCuadroFirmaEstado;
  observaciones: string | null;
  fecha_observacion: Date | null;
}

export interface Asignacion {
  cuadro_firma:    CuadroFirma;
  usuarioAsignado: UsuarioAsignado;
  usuarioCreador:  UsuarioCreador;
}

export interface CuadroFirma {
  titulo:       string;
  descripcion:  string;
  codigo:       string;
  version:      string;
  nombre_pdf:   string;
  estado_firma: Empresa;
  empresa:      Empresa;
  diasTranscurridos: number | undefined;
}

export interface Empresa {
  id:     number;
  nombre: string;
}

export interface UsuarioAsignado {
  id:                   number;
  primer_nombre:        string;
  segundo_name:         string;
  tercer_nombre:        null;
  primer_apellido:      string;
  segundo_apellido:     string;
  apellido_casada:      null;
  codigo_empleado:      string;
  posicion_id:          number;
  gerencia_id:          number;
  correo_institucional: string;
  telefono:             string;
  foto_perfil:          null;
  url_foto:             null;
  imagen_firma:         null;
  url_firma:            null;
  config_tema:          null;
  activo:               boolean;
  created_by:           null;
  add_date:             Date;
  updated_at:           Date;
  password:             string;
}

export interface UsuarioCreador {
  correo_institucional: string;
  codigo_empleado:      string;
}
