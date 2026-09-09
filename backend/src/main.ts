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

  /*
   * Whose IP the rate limiter counts.
   *
   * Behind nginx or Caddy every request arrives from the proxy, so without
   * this the throttler sees one address for the whole internet: real users
   * share a single bucket and start getting 429s, while an attacker spread
   * across many IPs is never noticed. Trusting the proxy makes it read the
   * real client from X-Forwarded-For.
   *
   * It is off by default on purpose. Turning it on when nothing sits in
   * front means anyone can forge that header and step around the limits
   * entirely — a failure that is silent. The wrong setting in the other
   * direction is loud (legitimate users hit 429), which is the safer way
   * round. Set TRUST_PROXY to the number of proxies in front of this
   * process: 1 for both the Docker and the nginx deployments.
   */
  const trustProxy = Number(process.env.TRUST_PROXY ?? 0);
  if (Number.isFinite(trustProxy) && trustProxy > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxy);
    console.log(`[Boot] Trusting ${trustProxy} proxy hop(s) for the client IP.`);
  } else {
    console.log('[Boot] TRUST_PROXY is off — rate limits count the direct peer address.');
  }

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
