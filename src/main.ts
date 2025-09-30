import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsoleLogger, Logger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { envs } from './config/envs';
import * as bodyParser from 'body-parser'; 
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      prefix: 'Genesis-Signin',
      timestamp: true,
    }),
  });

  app.setGlobalPrefix(envs.apiPrefix);

  const logger = new Logger(bootstrap.name);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.use(cookieParser());
  app.use(helmet());

  app.enableCors({
    origin: envs.corsOrigin,
    credentials: true,
  });


  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  /* await app.listen(envs.port ?? 3000); */
  await app.listen(3200, '0.0.0.0');
  logger.log(`Server running on port ${ envs.port }`);
  if (envs.nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('GenesisSign API')
      .setDescription(
        'Los endpoints protegidos aceptan autenticación con encabezado Authorization Bearer o la cookie de sesión access_token (__Host-access en producción).',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('access_token')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      useGlobalPrefix: true,
    });
  }
}
bootstrap();
