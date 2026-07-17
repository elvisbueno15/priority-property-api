import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { json, urlencoded, static as serveStatic } from 'express';
import { Server as IOServer } from 'socket.io';
import * as path from 'path';
import { AppModule } from './app.module';
import { EventsService } from './events/events.service';
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

  // ---- Realtime (Socket.io) — clients authenticate with their JWT and get
  // pushed 'chat' / 'activity' / 'meeting' events. Falls back to REST polling
  // automatically on networks where websockets don't get through.
  const jwt = app.get(JwtService, { strict: false });
  const io = new IOServer(app.getHttpServer(), {
    cors: { origin: true },
    path: '/socket.io',
  });
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = jwt.verify(token, { secret: process.env.JWT_SECRET || 'dev-secret-change-me' });
      (socket.data as any).userId = payload.sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });
  io.on('connection', (socket) => {
    socket.join('u:' + (socket.data as any).userId);
  });
  app.get(EventsService, { strict: false }).bind(io);

  console.log(`API running on http://0.0.0.0:${port}`);
}
bootstrap();
