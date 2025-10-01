import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { isAxiosError } from 'axios';
import { envs } from 'src/config/envs';
import { firstValueFrom } from 'rxjs';
import { YaloDocumentNotificationPayload } from './interface/yalo-notification.interface';
import { DocumentNotificationDto } from './dto/document-notification.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly httpService: HttpService) {}

  async sendDocumentUpdateNotification(
    documentNotificationDto: DocumentNotificationDto,
  ) {
    try {
      const payload: YaloDocumentNotificationPayload = {
        type: 'firmas_noti_3',
        users: [
          {
            priority: '<priority>',
            phone: `+${documentNotificationDto.phone}`,
            params: {
              responsable: documentNotificationDto.responsable,
              nombre_documento: `"${documentNotificationDto.nombreDocumento}"`,
              estado: documentNotificationDto.estado,
              fecha: documentNotificationDto.fechaHora,
              buttons: [
                {
                  sub_type: 'url',
                  index: 0,
                  parameters: [
                    {
                      text: documentNotificationDto.documentUrl,
                    }
                  ],
                },
              ],
            },
          },
        ],
      };
      const response = await firstValueFrom(
        this.httpService.post(envs.yaloHost, payload, {
          headers: {
            Authorization: `Bearer ${envs.yaloToken}`,
            'Content-Type': 'application/json',
          },
        }),
      );
      this.logger.log(`Notificación enviada: status=${response.status}`);
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        const status = error.response?.status ?? 'unknown';
        this.logger.error(
          `Error enviando notificación: status=${status}, message=${error.message}`,
        );
      } else if (error instanceof Error) {
        this.logger.error(`Error enviando notificación: ${error.message}`);
      } else {
        this.logger.error('Error enviando notificación: error desconocido');
      }
      throw error;
    }
  }
}
