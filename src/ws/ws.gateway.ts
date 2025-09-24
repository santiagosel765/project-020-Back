import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { WsService } from './ws.service';
import { Server, Socket } from 'socket.io';
import { envs } from 'src/config/envs';
import { verifyJwt } from 'src/auth/utils/jwt.util';
import { Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  NOTIFICATIONS_PAYLOAD_VERSION,
  UserNotificationsClientDto,
} from 'src/documents/dto/notification-response.dto';

@WebSocketGateway({
  cors: {
    origin: envs.corsOrigin,
    credentials: true,
  },
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private logger = new Logger(WsGateway.name);
  @WebSocketServer() wss: Server;

  constructor(private readonly wsService: WsService) {}

  handleDisconnect(client: Socket) {
    this.wsService.removeClient(client.id);
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  private parseCookies(cookieHeader?: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (!cookieHeader) {
      return cookies;
    }

    for (const chunk of cookieHeader.split(';')) {
      const [name, ...rest] = chunk.trim().split('=');
      if (!name) continue;
      cookies[decodeURIComponent(name)] = decodeURIComponent(rest.join('='));
    }

    return cookies;
  }

  private extractUserId(client: Socket): number {
    try {
      const cookies = this.parseCookies(client.handshake.headers.cookie);
      const accessToken = cookies['access_token'];
      if (!accessToken) {
        throw new WsException('Missing access token');
      }

      const payload = verifyJwt(accessToken, envs.jwtAccessSecret);
      const userId = Number(payload.sub);
      if (!userId) {
        throw new WsException('Invalid token payload');
      }
      return userId;
    } catch (error) {
      if (error instanceof WsException) {
        throw error;
      }
      throw new WsException('Unauthorized');
    }
  }

  private async validatePayload(
    data: unknown,
  ): Promise<UserNotificationsClientDto> {
    const payload = plainToInstance(UserNotificationsClientDto, data ?? {});
    const errors = await validate(payload, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length) {
      this.logger.warn(`Invalid WS payload: ${JSON.stringify(errors)}`);
      throw new WsException('Invalid payload');
    }

    if (payload.version !== NOTIFICATIONS_PAYLOAD_VERSION) {
      throw new WsException('Unsupported notifications payload version');
    }

    return payload;
  }

  async handleConnection(client: Socket) {
    try {
      const userId = this.extractUserId(client);
      await this.wsService.registerClient(client, userId);
      this.logger.log(
        `Cliente conectado: user=${userId} socket=${client.id} activos=${this.wsService.getConnectedClients()}`,
      );

      const notifications = await this.wsService.getNotificationsByUserId(
        userId,
        {
          page: 1,
          limit: 10,
        },
      );
      client.emit('user-notifications-server', notifications);
    } catch (error) {
      this.logger.error(
        `Error al conectar WS`,
        error instanceof Error ? error.stack : String(error),
      );
      client.disconnect();
    }
  }

  @SubscribeMessage('user-notifications-client')
  async onUserNotifications(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ) {
    try {
      const userId = this.extractUserId(client);
      const payload = await this.validatePayload(rawPayload);
      const notifications = await this.wsService.getNotificationsByUserId(
        userId,
        payload,
      );

      this.logger.log(
        `Notificaciones enviadas: user=${userId} cantidad=${notifications.data.items.length}`,
      );

      client.emit('user-notifications-server', notifications);
    } catch (error) {
      this.logger.error(
        `Error al obtener notificaciones del usuario - WS: ${error instanceof Error ? error.message : error}`,
      );
      client.disconnect(true);
    }
  }
}
