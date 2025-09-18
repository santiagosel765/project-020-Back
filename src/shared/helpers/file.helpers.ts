import { AWSService } from 'src/aws/aws.service';

export async function resolvePhotoUrl(
  aws: AWSService,
  raw?: string | null,
): Promise<string | null> {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return (await aws.getPresignedGetUrl(raw)) ?? null;
}
