import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma';
import {
  NotificacionesRepository,
  NotificationQueryOptions,
  NotificationQueryResult,
} from '../domain/repositories/notificaciones.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateNotificationDto } from 'src/documents/dto/create-notification.dto';
import { UpdateNotificationDto } from 'src/documents/dto/update-notification.dto';

@Injectable()
export class PrismaNotificacioensRepository
  implements NotificacionesRepository
{
  constructor(private prisma: PrismaService) {}

  async createNotification(createNotificationDto: CreateNotificationDto) {
    try {
      const { userId } = createNotificationDto;

      const createdNotification = await this.prisma.notificacion.create({
        data: {
          titulo: createNotificationDto.titulo,
          contenido: createNotificationDto.contenido,
          tipo: createNotificationDto.tipo,
          referencia_id: createNotificationDto.referenciaId,
          referencia_tipo: createNotificationDto.referenciaTipo,
        },
      });

      if (!createdNotification) {
        throw new HttpException(
          `Problemas al crear notificación`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // ? Hay escenarios en las que no especifica userId
      if (userId) {
        await this.createUserNotification(createdNotification.id, userId);
      }

      return createdNotification;
    } catch (error) {
      throw new HttpException(
        `Problemas al crear notificación: ${error}"`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createUserNotification(notificationId: number, userId: number) {
    try {
      await this.prisma.notificacion_user.create({
        data: {
          notificacion: { connect: { id: notificationId } },
          user: { connect: { id: userId } },
        },
      });
    } catch (error) {
      throw new HttpException(
        `Problemas al crear notificación de usuario con ID "${userId}": ${error}"`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findNotificationById(notificationId: number): Promise<void> {
    try {
      const dbNotification = await this.prisma.notificacion.findFirst({
        where: { id: notificationId },
      });
      if (!dbNotification) {
        throw new HttpException(
          `Notificación con ID "${notificationId}" no encontrada.`,
          HttpStatus.NOT_FOUND,
        );
      }
    } catch (error) {
      throw new HttpException(
        `Problemas al encontrar notificación: ${error}"`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findUserNotification(notificationId: number, userId: number) {
    try {
      const dbNotification = await this.prisma.notificacion_user.findFirst({
        where: { notificacion_id: notificationId, user_id: userId },
      });
      if (!dbNotification) {
        throw new HttpException(
          `Notificación de usuario con ID "${userId}" no encontrada.`,
          HttpStatus.NOT_FOUND,
        );
      }
    } catch (error) {
      throw new HttpException(
        `Problemas al encontrar notificación: ${error}"`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateNotification(updateNotificationdto: UpdateNotificationDto) {
    try {
      const { userId, notificationId } = updateNotificationdto;

      await this.findNotificationById(notificationId);
      await this.findUserNotification(notificationId, userId);

      await this.prisma.notificacion_user.update({
        where: {
          notificacion_id_user_id: {
            notificacion_id: notificationId,
            user_id: userId,
          },
        },
        data: {
          fue_leido: true,
          fecha_leido: new Date(),
        },
      });
    } catch (error) {
      throw new HttpException(
        `Problemas al actualizar notificación: ${error}"`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getNotificationsByUser(
    userId: number,
    options: NotificationQueryOptions,
  ): Promise<NotificationQueryResult> {
    const { pagination, since } = options ?? {};

    const page = Number(pagination?.page ?? 1);
    const limit = Number(pagination?.limit ?? 10);

    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;

    const skip = Math.max(0, (safePage - 1) * safeLimit);
    try {
      const where: Prisma.notificacion_userWhereInput = {
        user_id: userId,
      };

      if (since) {
        where.notificacion = { add_date: { gt: since } };
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.notificacion_user.count({ where }),
        this.prisma.notificacion_user.findMany({
          where,
          include: { notificacion: true },
          orderBy: {
            notificacion: { add_date: 'desc' },
          },
          skip,
          take: safeLimit,
        }),
      ]);

      return { items, total };
    } catch (error) {
      throw new HttpException(
        `Problemas al consultar notificaciones para el usuario con ID: "${userId}": ${error}"`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async markNotificationsAsRead(userId: number, notificationIds?: number[]) {
    try {
      const where: Prisma.notificacion_userWhereInput = {
        user_id: userId,
      };

      if (notificationIds?.length) {
        where.notificacion_id = { in: notificationIds };
      }

      const result = await this.prisma.notificacion_user.updateMany({
        where,
        data: { fue_leido: true, fecha_leido: new Date() },
      });

      return result.count;
    } catch (error) {
      throw new HttpException(
        `Problemas al marcar notificaciones como leídas para el usuario con ID: "${userId}": ${error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
