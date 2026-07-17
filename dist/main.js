"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const jwt_1 = require("@nestjs/jwt");
const express_1 = require("express");
const socket_io_1 = require("socket.io");
const path = __importStar(require("path"));
const app_module_1 = require("./app.module");
const events_service_1 = require("./events/events.service");
const data_dir_util_1 = require("./data-dir.util");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bodyParser: false });
    // Screenshots llegan como base64 — subir el límite del body.
    app.use((0, express_1.json)({ limit: '25mb' }));
    app.use((0, express_1.urlencoded)({ extended: true, limit: '25mb' }));
    // La app Electron corre desde file:// y otros equipos de la red — reflejar cualquier origen.
    app.enableCors({ origin: true });
    app.use('/screenshots', (0, express_1.static)(path.join(data_dir_util_1.DATA_DIR, 'screenshots')));
    // Landing page ("download the app" site) served at the root URL.
    app.use((0, express_1.static)(path.join(__dirname, '..', 'public'), { index: 'index.html' }));
    const port = Number(process.env.PORT) || 3001;
    await app.listen(port, '0.0.0.0');
    // ---- Realtime (Socket.io) — clients authenticate with their JWT and get
    // pushed 'chat' / 'activity' / 'meeting' events. Falls back to REST polling
    // automatically on networks where websockets don't get through.
    const jwt = app.get(jwt_1.JwtService, { strict: false });
    const io = new socket_io_1.Server(app.getHttpServer(), {
        cors: { origin: true },
        path: '/socket.io',
    });
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            const payload = jwt.verify(token, { secret: process.env.JWT_SECRET || 'dev-secret-change-me' });
            socket.data.userId = payload.sub;
            next();
        }
        catch {
            next(new Error('unauthorized'));
        }
    });
    io.on('connection', (socket) => {
        socket.join('u:' + socket.data.userId);
    });
    app.get(events_service_1.EventsService, { strict: false }).bind(io);
    console.log(`API running on http://0.0.0.0:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map