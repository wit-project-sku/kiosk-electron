"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppEnv = exports.Parity = void 0;
exports.validateAppEnv = validateAppEnv;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
var Parity;
(function (Parity) {
    Parity["NONE"] = "none";
    Parity["EVEN"] = "even";
    Parity["ODD"] = "odd";
    Parity["MARK"] = "mark";
    Parity["SPACE"] = "space";
})(Parity || (exports.Parity = Parity = {}));
class AppEnv {
    HTTP_HOST = '127.0.0.1';
    HTTP_PORT = 8080;
    NODE_ENV;
    LOG_LEVEL;
    CORS_ORIGINS = 'http://localhost:3000,https://witglobaldonation.netlify.app';
    CENTRAL_BASE_URL;
    CENTRAL_AUTH_TOKEN;
    CENTRAL_TIMEOUT_MS = 10_000;
    TL3800_TERMINAL_ID;
    TL3800_LOG_CONFIG_DISCOVERY = false;
    TL3800_BAUD_RATE = 9600;
    TL3800_BAUD_FALLBACKS;
    TL3800_DATA_BITS = 8;
    TL3800_STOP_BITS = 1;
    TL3800_PARITY = Parity.NONE;
    TL3800_PORT;
    TL3800_ACK_WAIT_MS = 3_000;
    TL3800_RESP_WAIT_MS = 10_000;
    TL3800_MAX_ACK_RETRY = 3;
    TL3800_FOLLOWUP_WINDOW_MS = 180_000;
    OUTBOX_DB_PATH = './data/outbox.sqlite';
    OUTBOX_WORKER_INTERVAL_MS = 15_000;
    OUTBOX_MAX_ATTEMPTS = 20;
}
exports.AppEnv = AppEnv;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], AppEnv.prototype, "HTTP_HOST", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(65535),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Object)
], AppEnv.prototype, "HTTP_PORT", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AppEnv.prototype, "NODE_ENV", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], AppEnv.prototype, "LOG_LEVEL", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], AppEnv.prototype, "CORS_ORIGINS", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AppEnv.prototype, "CENTRAL_BASE_URL", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' ? undefined : value)),
    __metadata("design:type", String)
], AppEnv.prototype, "CENTRAL_AUTH_TOKEN", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(100),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Object)
], AppEnv.prototype, "CENTRAL_TIMEOUT_MS", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AppEnv.prototype, "TL3800_TERMINAL_ID", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    (0, class_transformer_1.Transform)(({ value }) => typeof value === 'string'
        ? ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
        : Boolean(value)),
    __metadata("design:type", Object)
], AppEnv.prototype, "TL3800_LOG_CONFIG_DISCOVERY", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1200),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Object)
], AppEnv.prototype, "TL3800_BAUD_RATE", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' ? undefined : value)),
    __metadata("design:type", String)
], AppEnv.prototype, "TL3800_BAUD_FALLBACKS", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(5),
    (0, class_validator_1.Max)(8),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Object)
], AppEnv.prototype, "TL3800_DATA_BITS", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(2),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Object)
], AppEnv.prototype, "TL3800_STOP_BITS", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(Parity),
    __metadata("design:type", String)
], AppEnv.prototype, "TL3800_PARITY", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => (value === '' ? undefined : value)),
    __metadata("design:type", String)
], AppEnv.prototype, "TL3800_PORT", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(100),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Object)
], AppEnv.prototype, "TL3800_ACK_WAIT_MS", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(500),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Object)
], AppEnv.prototype, "TL3800_RESP_WAIT_MS", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Object)
], AppEnv.prototype, "TL3800_MAX_ACK_RETRY", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1000),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Object)
], AppEnv.prototype, "TL3800_FOLLOWUP_WINDOW_MS", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], AppEnv.prototype, "OUTBOX_DB_PATH", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1000),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Object)
], AppEnv.prototype, "OUTBOX_WORKER_INTERVAL_MS", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Object)
], AppEnv.prototype, "OUTBOX_MAX_ATTEMPTS", void 0);
function validateAppEnv(raw) {
    const candidate = (0, class_transformer_1.plainToInstance)(AppEnv, raw, {
        enableImplicitConversion: true,
    });
    const errors = (0, class_validator_1.validateSync)(candidate, { skipMissingProperties: false });
    if (errors.length > 0) {
        const lines = errors
            .map((e) => {
            const constraints = e.constraints
                ? Object.values(e.constraints).join('; ')
                : 'invalid';
            return `  • ${e.property}: ${constraints}`;
        })
            .join('\n');
        throw new Error(`Invalid environment configuration:\n${lines}`);
    }
    return candidate;
}
//# sourceMappingURL=configuration.js.map