"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = __importDefault(require("helmet"));
require("reflect-metadata");
const app_module_1 = require("./app.module");
const logger_1 = require("./logger");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: (0, logger_1.createLogger)(),
        bufferLogs: true,
    });
    const bootLogger = new common_1.Logger('Bootstrap');
    const config = app.get(config_1.ConfigService);
    app.use((0, helmet_1.default)());
    const corsOrigins = config
        .getOrThrow('CORS_ORIGINS')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    bootLogger.log(`CORS origins: ${corsOrigins.length > 0 ? corsOrigins.join(', ') : '(disabled)'}`);
    app.enableCors({
        origin: corsOrigins.length > 0 ? corsOrigins : false,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        maxAge: 3600,
    });
    app.use((req, res, next) => {
        const startedAt = Date.now();
        const origin = req.header('origin') ?? '-';
        const referer = req.header('referer') ?? '-';
        const authState = req.header('authorization') ? 'present' : 'missing';
        res.on('finish', () => {
            const durationMs = Date.now() - startedAt;
            const line = `${req.method} ${req.originalUrl} -> ${res.statusCode} ` +
                `${durationMs}ms origin=${origin} referer=${referer} auth=${authState}`;
            if (res.statusCode === 401 || res.statusCode === 403) {
                bootLogger.warn(`AUTH/CORS DEBUG ${line}`);
                return;
            }
            if (res.statusCode >= 400) {
                bootLogger.warn(`HTTP DEBUG ${line}`);
                return;
            }
            bootLogger.debug(`HTTP ${line}`);
        });
        next();
    });
    const swaggerEnabled = process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true';
    if (swaggerEnabled) {
        const doc = new swagger_1.DocumentBuilder()
            .setTitle('💳 WIT Global 결제 중개 API')
            .setDescription('키오스크 ↔ TL-3800 카드 단말기 ↔ 중앙 서버 중개 에이전트 (Node.js/NestJS 포트)')
            .setVersion('1.0.0')
            .setContact('Witteria', '', 'unijun0109@gmail.com')
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, doc);
        swagger_1.SwaggerModule.setup('swagger-ui', app, document);
        bootLogger.log('Swagger UI available at /swagger-ui');
    }
    app.enableShutdownHooks();
    const port = config.getOrThrow('HTTP_PORT');
    const host = config.getOrThrow('HTTP_HOST');
    await app.listen(port, host);
    bootLogger.log(`HTTP server listening on http://${host}:${port}`);
    const shutdown = (signal) => {
        bootLogger.log(`Received ${signal} — shutting down gracefully…`);
        void app
            .close()
            .catch((err) => bootLogger.error(`shutdown error: ${err.message}`))
            .finally(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
bootstrap().catch((err) => {
    console.error('Fatal boot error:', err);
    process.exit(1);
});
//# sourceMappingURL=main.js.map