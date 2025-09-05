import { createHmac } from 'crypto';

interface JwtOptions {
  expiresIn: number; // seconds
  secret: string;
}

export function signJwt(
  payload: Record<string, any>,
  options: JwtOptions,
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + options.expiresIn;
  const fullPayload = { ...payload, exp };
  const headerEncoded = Buffer.from(JSON.stringify(header)).toString(
    'base64url',
  );
  const payloadEncoded = Buffer.from(JSON.stringify(fullPayload)).toString(
    'base64url',
  );
  const signature = createHmac('sha256', options.secret)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64url');
  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

export function verifyJwt(token: string, secret: string): Record<string, any> {
  const [headerB64, payloadB64, signature] = token.split('.');
  const expectedSig = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  if (expectedSig !== signature) {
    throw new Error('Invalid signature');
  }
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }
  return payload;
}
