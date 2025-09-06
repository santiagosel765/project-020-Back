import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsoleLogger, Logger, ValidationPipe } from '@nestjs/common';
import { envs } from './config/envs';
import { cookieParser } from './common/cookie-parser';

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
      forbidNonWhitelisted: true,
    }),
  );

  app.use(cookieParser);

  app.enableCors({
    origin: envs.corsOrigin,
    credentials: true,
  });

  await app.listen(envs.port ?? 3000);
  logger.log(`Server running on port ${envs.port}`);
}
bootstrap();
