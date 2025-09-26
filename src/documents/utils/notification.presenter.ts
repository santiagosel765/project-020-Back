import { buildPageMeta } from 'src/shared/utils/pagination';
import type { NotificationWithMetadata } from 'src/database/domain/repositories/notificaciones.repository';
import { NOTIFICATIONS_PAYLOAD_VERSION } from '../dto/notification-response.dto';

export interface NotificationViewModel {
  id: number;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  href: string;
  icon: string | null;
}

export interface NotificationMetaViewModel {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface NotificationListViewModel {
  version: string;
  data: {
    items: NotificationViewModel[];
    meta: NotificationMetaViewModel;
  };
}

export function mapNotification(
  item: NotificationWithMetadata,
): NotificationViewModel {
  const { notificacion, fue_leido } = item;

  const notificationRecord = notificacion as unknown as Record<string, unknown>;
  const itemRecord = item as unknown as Record<string, unknown>;

  const candidateIds = [
    notificacion.referencia_id,
    notificationRecord.cuadro_firma_id,
    notificationRecord.documentId,
    notificationRecord.document_id,
    notificationRecord.targetId,
    notificationRecord.target_id,
    itemRecord.cuadro_firma_id,
    itemRecord.documentId,
    itemRecord.document_id,
    itemRecord.targetId,
    itemRecord.target_id,
  ];

  const directDocId = candidateIds.find((value) =>
    typeof value === 'number' && Number.isFinite(value),
  ) as number | undefined;

  const extractIdFromHref = (href?: unknown) => {
    if (typeof href !== 'string') {
      return null;
    }
    const match = href.match(/(\d+)(?!.*\d)/);
    return match ? Number(match[1]) : null;
  };

  const legacyHref = notificationRecord.href ?? itemRecord.href;

  const docId = directDocId ?? extractIdFromHref(legacyHref);

  const href = docId ? `/documento/${docId}` : '';

  return {
    id: notificacion.id,
    title: notificacion.titulo,
    message: notificacion.contenido,
    createdAt: (notificacion.add_date ?? new Date()).toISOString(),
    isRead: Boolean(fue_leido),
    href,
    icon: notificacion.tipo ?? null,
  };
}

export function buildNotificationPayload(
  records: NotificationWithMetadata[],
  total: number,
  page: number,
  limit: number,
): NotificationListViewModel {
  const metaBase = buildPageMeta(total, page, limit);
  const meta = {
    ...metaBase,
    hasPrev: page > 1,
    hasNext: page < metaBase.pages,
  };

  return {
    version: NOTIFICATIONS_PAYLOAD_VERSION,
    data: {
      items: records.map(mapNotification),
      meta,
    },
  };
}
