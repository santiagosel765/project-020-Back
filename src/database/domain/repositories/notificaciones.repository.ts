import type { notificacion, Prisma } from 'generated/prisma';
import type { PaginationDto } from 'src/common/dto/pagination.dto';
import { CreateNotificationDto } from 'src/documents/dto/create-notification.dto';
import { UpdateNotificationDto } from 'src/documents/dto/update-notification.dto';

export const NOTIFICACIONES_REPOSITORY = 'NOTIFICACIONES_REPOSITORY';

export type NotificationWithMetadata = Prisma.notificacion_userGetPayload<{
  include: {
    notificacion: true;
  };
}>;

export interface NotificationQueryOptions {
  pagination: Pick<PaginationDto, 'page' | 'limit'>;
  since?: Date;
}

export interface NotificationQueryResult {
  items: NotificationWithMetadata[];
  total: number;
}

export abstract class NotificacionesRepository {
  abstract createNotification(
    createNotificationDto: CreateNotificationDto,
  ): Promise<notificacion>;
  abstract updateNotification(
    updateNotificationDto: UpdateNotificationDto,
  ): Promise<void>;
  abstract findNotificationById(notificationId: number): Promise<void>;
  abstract findUserNotification(
    notificationId: number,
    userId: number,
  ): Promise<void>;
  abstract createUserNotification(
    notificationId: number,
    userId: number,
  ): Promise<void>;
  abstract getNotificationsByUser(
    userId: number,
    options: NotificationQueryOptions,
  ): Promise<NotificationQueryResult>;
  abstract markNotificationsAsRead(
    userId: number,
    notificationIds?: number[],
  ): Promise<number>;
}
