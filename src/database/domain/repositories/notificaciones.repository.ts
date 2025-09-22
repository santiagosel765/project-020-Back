import { notificacion, Prisma } from "generated/prisma";
import { CreateNotificationDto } from "src/documents/dto/create-notification.dto";
import { UpdateNotificationDto } from "src/documents/dto/update-notification.dto";

export const NOTIFICACIONES_REPOSITORY = 'NOTIFICACIONES_REPOSITORY';

export abstract class NotificacionesRepository {
  abstract createNotification(createNotificationDto: CreateNotificationDto): Promise<notificacion>;
  abstract updateNotification(updateNotificationDto: UpdateNotificationDto): Promise<void>;
  abstract findNotificationById(notificationId: number): Promise<void>;
  abstract findUserNotification(notificationId: number, userId: number): Promise<void>;
  abstract createUserNotification(notificationId: number, userId: number): Promise<void>;
  abstract getNotificationsByUser(userId: number);
}
