export class CreateNotificationDto {
    titulo: string;
    contenido: string;
    tipo: string;
    referenciaId: number;
    referenciaTipo: string;
    userId?: number;
}