export class MePageDto {
  id!: number;
  nombre!: string;
  url!: string;
}

export class MeResponseDto {
  id!: number;
  nombre!: string;
  correo!: string;
  pages!: MePageDto[];
}
