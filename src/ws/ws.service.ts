import { Inject, Injectable, Logger } from '@nestjs/common';
import { user } from 'generated/prisma';
import { Socket } from 'socket.io';
import {
  NOTIFICACIONES_REPOSITORY,
  NotificacionesRepository,
} from 'src/database/domain/repositories/notificaciones.repository';
import {
  USERS_REPOSITORY,
  UsersRepository,
} from 'src/database/domain/repositories/users.repository';
import {
  buildNotificationPayload,
  NotificationListViewModel,
} from 'src/documents/utils/notification.presenter';
import { NotificationPaginationDto } from 'src/documents/dto/notification-response.dto';

interface ConnectedClients {
  [id: string]: {
    socket: Socket;
    user: user;
  };
}

@Injectable()
export class WsService {
  private logger = new Logger(WsService.name);
  private connectedClients: ConnectedClients = {};

  constructor(
    @Inject(NOTIFICACIONES_REPOSITORY)
    private readonly notificacionesRepository: NotificacionesRepository,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  /**
   * Registra un nuevo cliente WebSocket en el sistema.
   *
   * - Busca el usuario por su ID y verifica que esté activo.
   * - Si el usuario ya tiene una conexión activa, desconecta la anterior para evitar múltiples conexiones simultáneas.
   * - Asocia el socket y el usuario al listado de clientes conectados.
   *
   * @param client - Instancia del socket del cliente que se conecta.
   * @param userId - ID del usuario que se está conectando.
   * @throws Error si el usuario no está activo.
   */
  async registerClient(client: Socket, userId: number) {
    const user = await this.usersRepository.findUserById(userId);

    if (!user.activo) {
      throw new Error(`El usuario con ID ${userId} no está activo`);
    }

    this.checkUserConnection(user);

    this.connectedClients[client.id] = {
      socket: client,
      user,
    };

    this.logger.log(`Usuario con ID ${userId} conectado exitosamente`);
  }

  removeClient(clientId: string) {
    this.logger.log(`Cliente a desconectar con ID ${clientId}`);
    delete this.connectedClients[clientId];
  }

  getConnectedClients(): number {
    return Object.keys(this.connectedClients).length;
  }

  async getNotificationsByUserId(
    userId: number,
    pagination: NotificationPaginationDto,
  ): Promise<NotificationListViewModel> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const since = pagination.since ? new Date(pagination.since) : undefined;

    const { items, total } =
      await this.notificacionesRepository.getNotificationsByUser(userId, {
        pagination: { page, limit },
        since,
      });

    return buildNotificationPayload(items, total, page, limit);
  }

  /**
   * Emite las notificaciones actuales de un usuario a todos sus sockets conectados.
   *
   * - Busca todos los sockets activos asociados al userId proporcionado (por ejemplo, si el usuario tiene varias pestañas o dispositivos).
   * - Obtiene las notificaciones del usuario desde el repositorio.
   * - Envía el evento 'user-notifications-server' con la lista de notificaciones y el total a cada socket conectado de ese usuario.
   *
   * @param userId - ID del usuario al que se le enviarán las notificaciones.
   */
  async emitNotificationsToUser(userId: number) {
    // ? Busca todos los sockets conectados de ese usuario (por si tiene varias pestañas)
    for (const clientId in this.connectedClients) {
      const clientData = this.connectedClients[clientId];
      if (clientData.user.id === userId) {
        const notifications = await this.getNotificationsByUserId(userId, {
          page: 1,
          limit: 10,
        });
        clientData.socket.emit('user-notifications-server', notifications);
      }
    }
  }

  /**
   * Verifica si el usuario ya tiene una conexión WebSocket activa.
   *
   * Si encuentra un cliente conectado con el mismo user.id, desconecta ese socket
   * para evitar múltiples conexiones simultáneas del mismo usuario.
   *
   * @param user - Objeto de usuario que se está intentando conectar.
   */
  private checkUserConnection(user: user) {
    for (const clientId of Object.keys(this.connectedClients)) {
      const connectedClient = this.connectedClients[clientId];

      if (connectedClient.user.id === user.id) {
        connectedClient.socket.disconnect();
        break;
      }
    }
  }
}
