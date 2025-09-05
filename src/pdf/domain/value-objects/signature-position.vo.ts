export class SignaturePosition {
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;

  constructor(params: { page: number; x: number; y: number; width?: number; height?: number }) {
    if (params.page < 0) throw new Error('Page must be >= 0');
    if (params.x < 0) throw new Error('X must be >= 0');
    if (params.y < 0) throw new Error('Y must be >= 0');
    if (params.width !== undefined && params.width <= 0) throw new Error('Width must be > 0');
    if (params.height !== undefined && params.height <= 0) throw new Error('Height must be > 0');

    this.page = params.page;
    this.x = params.x;
    this.y = params.y;
    this.width = params.width;
    this.height = params.height;
  }
}
