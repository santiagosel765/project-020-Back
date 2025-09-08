-- CreateTable
CREATE TABLE "public"."auditoria" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "entidad" VARCHAR NOT NULL,
    "entidad_id" INTEGER NOT NULL,
    "accion" VARCHAR NOT NULL,
    "descripcion" VARCHAR,
    "add_date" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cuadro_firma" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR NOT NULL,
    "descripcion" TEXT,
    "version" VARCHAR,
    "codigo" VARCHAR,
    "pdf" BYTEA,
    "empresa_id" INTEGER,
    "created_by" INTEGER,
    "estado_firma_id" INTEGER,
    "plantilla_id" INTEGER,
    "add_date" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuadro_firma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cuadro_firma_estado_historial" (
    "id" SERIAL NOT NULL,
    "cuadro_firma_id" INTEGER NOT NULL,
    "estado_firma_id" INTEGER NOT NULL,
    "observaciones" TEXT,
    "user_id" INTEGER NOT NULL,
    "fecha_observacion" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuadro_firma_estado_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cuadro_firma_user" (
    "cuadro_firma_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "responsabilidad_id" INTEGER,

    CONSTRAINT "cuadro_firma_user_pkey" PRIMARY KEY ("cuadro_firma_id","user_id")
);

-- CreateTable
CREATE TABLE "public"."documento" (
    "id" SERIAL NOT NULL,
    "cuadro_firma_id" INTEGER NOT NULL,
    "nombre_archivo" VARCHAR NOT NULL,
    "descripcion" TEXT,
    "pdf" BYTEA,
    "created_by" INTEGER,
    "add_date" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."empresa" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN DEFAULT true,
    "add_date" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."estado_firma" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR NOT NULL,
    "descripcion" TEXT,
    "add_date" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estado_firma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."gerencia" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN DEFAULT true,

    CONSTRAINT "gerencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notificacion" (
    "id" SERIAL NOT NULL,
    "titulo" VARCHAR NOT NULL,
    "contenido" TEXT NOT NULL,
    "tipo" VARCHAR,
    "referencia_id" INTEGER,
    "referencia_tipo" VARCHAR,
    "add_date" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notificacion_user" (
    "notificacion_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "fue_leido" BOOLEAN DEFAULT false,
    "fecha_leido" TIMESTAMP(6),

    CONSTRAINT "notificacion_user_pkey" PRIMARY KEY ("notificacion_id","user_id")
);

-- CreateTable
CREATE TABLE "public"."pagina" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR NOT NULL,
    "descripcion" TEXT,
    "url" VARCHAR NOT NULL,
    "activo" BOOLEAN DEFAULT true,
    "add_date" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pagina_rol" (
    "pagina_id" INTEGER NOT NULL,
    "rol_id" INTEGER NOT NULL,

    CONSTRAINT "pagina_rol_pkey" PRIMARY KEY ("pagina_id","rol_id")
);

-- CreateTable
CREATE TABLE "public"."plantilla" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR NOT NULL,
    "color" VARCHAR,
    "descripcion" TEXT,
    "plantilla" BYTEA,
    "empresa_id" INTEGER NOT NULL,
    "activo" BOOLEAN DEFAULT true,
    "add_date" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plantilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."posicion" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN DEFAULT true,

    CONSTRAINT "posicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."responsabilidad_firma" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN DEFAULT true,
    "add_date" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "responsabilidad_firma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rol" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR NOT NULL,
    "descripcion" VARCHAR,
    "activo" BOOLEAN DEFAULT true,
    "created_by" INTEGER,
    "add_date" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rol_usuario" (
    "user_id" INTEGER NOT NULL,
    "rol_id" INTEGER NOT NULL,

    CONSTRAINT "rol_usuario_pkey" PRIMARY KEY ("user_id","rol_id")
);

-- CreateTable
CREATE TABLE "public"."user" (
    "id" SERIAL NOT NULL,
    "primer_nombre" VARCHAR NOT NULL,
    "segundo_name" VARCHAR,
    "tercer_nombre" VARCHAR,
    "primer_apellido" VARCHAR NOT NULL,
    "segundo_apellido" VARCHAR,
    "apellido_casada" VARCHAR,
    "codigo_empleado" VARCHAR NOT NULL,
    "posicion_id" INTEGER,
    "gerencia_id" INTEGER,
    "correo_institucional" VARCHAR NOT NULL,
    "telefono" VARCHAR,
    "foto_perfil" BYTEA,
    "imagen_firma" BYTEA,
    "config_tema" VARCHAR,
    "activo" BOOLEAN DEFAULT true,
    "created_by" INTEGER,
    "add_date" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuadro_firma_codigo_key" ON "public"."cuadro_firma"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "empresa_nombre_key" ON "public"."empresa"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "estado_firma_nombre_key" ON "public"."estado_firma"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "gerencia_nombre_key" ON "public"."gerencia"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "pagina_nombre_key" ON "public"."pagina"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "posicion_nombre_key" ON "public"."posicion"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "responsabilidad_firma_nombre_key" ON "public"."responsabilidad_firma"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "rol_nombre_key" ON "public"."rol"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "user_codigo_empleado_key" ON "public"."user"("codigo_empleado");

-- CreateIndex
CREATE UNIQUE INDEX "user_correo_institucional_key" ON "public"."user"("correo_institucional");

-- AddForeignKey
ALTER TABLE "public"."auditoria" ADD CONSTRAINT "auditoria_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cuadro_firma" ADD CONSTRAINT "fk_cuadro_firma_created_by" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cuadro_firma" ADD CONSTRAINT "fk_cuadro_firma_empresa" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cuadro_firma" ADD CONSTRAINT "fk_cuadro_firma_estado" FOREIGN KEY ("estado_firma_id") REFERENCES "public"."estado_firma"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cuadro_firma" ADD CONSTRAINT "fk_cuadro_firma_plantilla" FOREIGN KEY ("plantilla_id") REFERENCES "public"."plantilla"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cuadro_firma_estado_historial" ADD CONSTRAINT "cuadro_firma_estado_historial_cuadro_firma_id_fkey" FOREIGN KEY ("cuadro_firma_id") REFERENCES "public"."cuadro_firma"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cuadro_firma_estado_historial" ADD CONSTRAINT "cuadro_firma_estado_historial_estado_firma_id_fkey" FOREIGN KEY ("estado_firma_id") REFERENCES "public"."estado_firma"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cuadro_firma_estado_historial" ADD CONSTRAINT "cuadro_firma_estado_historial_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cuadro_firma_user" ADD CONSTRAINT "cuadro_firma_user_cuadro_firma_id_fkey" FOREIGN KEY ("cuadro_firma_id") REFERENCES "public"."cuadro_firma"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cuadro_firma_user" ADD CONSTRAINT "cuadro_firma_user_responsabilidad_id_fkey" FOREIGN KEY ("responsabilidad_id") REFERENCES "public"."responsabilidad_firma"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cuadro_firma_user" ADD CONSTRAINT "cuadro_firma_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."documento" ADD CONSTRAINT "fk_documento_created_by" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."documento" ADD CONSTRAINT "fk_documento_cuadro_firma" FOREIGN KEY ("cuadro_firma_id") REFERENCES "public"."cuadro_firma"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."notificacion_user" ADD CONSTRAINT "notificacion_user_notificacion_id_fkey" FOREIGN KEY ("notificacion_id") REFERENCES "public"."notificacion"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."notificacion_user" ADD CONSTRAINT "notificacion_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pagina_rol" ADD CONSTRAINT "pagina_rol_pagina_id_fkey" FOREIGN KEY ("pagina_id") REFERENCES "public"."pagina"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pagina_rol" ADD CONSTRAINT "pagina_rol_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."rol"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."plantilla" ADD CONSTRAINT "plantilla_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."rol" ADD CONSTRAINT "fk_rol_created_by" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."rol_usuario" ADD CONSTRAINT "rol_usuario_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."rol"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."rol_usuario" ADD CONSTRAINT "rol_usuario_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."user" ADD CONSTRAINT "fk_user_created_by" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."user" ADD CONSTRAINT "fk_user_gerencia" FOREIGN KEY ("gerencia_id") REFERENCES "public"."gerencia"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."user" ADD CONSTRAINT "fk_user_posicion" FOREIGN KEY ("posicion_id") REFERENCES "public"."posicion"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
