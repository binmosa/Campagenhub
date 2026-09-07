import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET environment variable is required. Generate one with: openssl rand -base64 48',
    );
  }

  const app = await NestFactory.create(AppModule);

  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Increase payload size limit for Video pitches (Base64 is large)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  /*
   * Bind address. 0.0.0.0 is required inside a container (the port has to be
   * reachable from the Docker network). On a bare server where a local nginx
   * proxies to this process, set HOST=127.0.0.1 so the API is not exposed
   * directly even if the firewall is later opened.
   */
  await app.listen(Number(process.env.PORT ?? 3001), process.env.HOST || '0.0.0.0');
}
bootstrap();
