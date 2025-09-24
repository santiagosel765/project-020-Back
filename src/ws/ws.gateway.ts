import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { WsService } from './ws.service';
import { Server, Socket } from 'socket.io';
import { envs } from 'src/config/envs';
import { verifyJwt } from 'src/auth/utils/jwt.util';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' } })
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private logger = new Logger(WsGateway.name);
  @WebSocketServer() wss: Server;

  constructor(private readonly wsService: WsService) {}

  handleDisconnect(client: Socket) {
    this.wsService.removeClient(client.id);
  }

  private getAccessToken(client: Socket) {
    const cookies = client.handshake.headers.cookie;
    let accessToken = cookies?.split(';')[1].trim();
    accessToken = accessToken?.replace('access_token=', '') ?? '';
    accessToken = accessToken?.replace('refresh_token=', '') ?? '';
    return accessToken;
  }

  handleConnection(client: Socket) {
    try {
      const accessToken = this.getAccessToken(client);
      this.logger.log(`Access token de ingreso ${accessToken}`);
      // ? payload: { sub: 1, email: 'admin@local.com', roleIds: [ 1 ], exp: 1758653920 }
      const payload = verifyJwt(accessToken, envs.jwtRefreshSecret);
      const userId = payload.sub;
      this.logger.log(`ID de usuario a registrar: ${ userId}`);
      this.wsService.registerClient(client, userId);
      this.logger.log(`Clientes conectados: ${this.wsService.getConnectedClients()}`);
    } catch (error) {
      client.disconnect();
      this.logger.error(`Error al conectar WS: ${error}`);
    }
  }

  @SubscribeMessage('user-notifications-client')
  async onUserNotifications(client: Socket) {
    try {
      const accessToken = this.getAccessToken(client);
      this.logger.log(`Access token a validar ${accessToken}`);
      const payload = verifyJwt(accessToken, envs.jwtRefreshSecret);
      const userId = payload.sub;
      this.logger.log(`ID de usuario a consultar: ${ userId}`);
      const userNotifications =
      await this.wsService.getNotificationsByUserId(userId);
      this.logger.log(`Cantidad de notificaciones consultadas: ${ userNotifications.length }`);
      client.emit('user-notifications-server', {
        userNotifications,
        totalNotificaciones: userNotifications.length,
      });
    } catch (error) {
      client.disconnect();
      this.logger.error(
        `Error al obtener notificaciones del usuario - WS: ${error}`,
      );
    }
  }
}
