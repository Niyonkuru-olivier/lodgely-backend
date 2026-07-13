import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as dns from 'dns';
import { freePort } from './common/utils/free-port.util';

// Prefer IPv4 — avoids smtp.gmail.com ENOTFOUND / IPv6 issues on some Windows networks
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Unsupported on older Node versions
}

// Load environment variables
dotenv.config();

async function bootstrap() {
  const port = Number(process.env.PORT) || 5000;

  // Always clear the port before listen so leftover Nest processes cannot block startup
  freePort(port);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();
