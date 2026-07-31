"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxModule = void 0;
const axios_1 = require("@nestjs/axios");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const outbox_worker_1 = require("./outbox.worker");
const outbox_service_1 = require("./outbox.service");
let OutboxModule = class OutboxModule {
};
exports.OutboxModule = OutboxModule;
exports.OutboxModule = OutboxModule = __decorate([
    (0, common_1.Module)({
        imports: [
            axios_1.HttpModule.registerAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    baseURL: config.getOrThrow('CENTRAL_BASE_URL'),
                    timeout: config.getOrThrow('CENTRAL_TIMEOUT_MS'),
                    headers: { 'content-type': 'application/json' },
                }),
            }),
        ],
        providers: [outbox_service_1.OutboxService, outbox_worker_1.OutboxWorker],
        exports: [outbox_service_1.OutboxService],
    })
], OutboxModule);
//# sourceMappingURL=outbox.module.js.map