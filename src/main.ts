import { NestFactory } from '@nestjs/core';
import { json, urlencoded, static as serveStatic } from 'express';
import * as path from 'path';
import { AppModule } from './app.module';
import { DATA_DIR } from './data-dir.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Screenshots llegan como base64 — subir el límite del body.
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));
  // La app Electron corre desde file:// y otros equipos de la red — reflejar cualquier origen.
  app.enableCors({ origin: true });
  app.use('/screenshots', serveStatic(path.join(DATA_DIR, 'screenshots')));
  // Landing page ("download the app" site) served at the root URL.
  app.use(serveStatic(path.join(__dirname, '..', 'public'), { index: 'index.html' }));
  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`API running on http://0.0.0.0:${port}`);
}
bootstrap();
