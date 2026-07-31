"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CentralModule = void 0;
const axios_1 = require("@nestjs/axios");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const outbox_module_1 = require("../outbox/outbox.module");
const central_payment_client_1 = require("./central-payment.client");
let CentralModule = class CentralModule {
};
exports.CentralModule = CentralModule;
exports.CentralModule = CentralModule = __decorate([
    (0, common_1.Module)({
        imports: [
            axios_1.HttpModule.registerAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => {
                    const authToken = config.get('CENTRAL_AUTH_TOKEN');
                    const authorization = authToken
                        ? authToken.startsWith('Bearer ')
                            ? authToken
                            : `Bearer ${authToken}`
                        : undefined;
                    return {
                        baseURL: config.getOrThrow('CENTRAL_BASE_URL'),
                        timeout: config.getOrThrow('CENTRAL_TIMEOUT_MS'),
                        headers: {
                            'content-type': 'application/json',
                            ...(authorization ? { authorization } : {}),
                        },
                    };
                },
            }),
            outbox_module_1.OutboxModule,
        ],
        providers: [central_payment_client_1.CentralPaymentClient],
        exports: [central_payment_client_1.CentralPaymentClient],
    })
], CentralModule);
//# sourceMappingURL=central.module.js.map