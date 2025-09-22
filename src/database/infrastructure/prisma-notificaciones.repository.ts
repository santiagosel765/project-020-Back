import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { NotificacionesRepository } from '../domain/repositories/notificaciones.repository';
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
      const { userId, ...dataNotification } = createNotificationDto;

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
        this.createUserNotification(createdNotification.id, userId);
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
      console.log(updateNotificationdto)
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

  async getNotificationsByUser(userId: number) {
    try {
      return await this.prisma.notificacion_user.findMany({
        where: {
          user_id: userId,
        },
        select: {
          fue_leido: true,
          fecha_leido: true,
          notificacion: true,
        },
      });
    } catch (error) {
      throw new HttpException(
        `Problemas al consultar notificaciones para el usuario con ID: "${userId}": ${error}"`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
