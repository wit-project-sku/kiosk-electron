"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const common_2 = require("@nestjs/common");
const all_exceptions_filter_1 = require("./common/filters/all-exceptions.filter");
const config_module_1 = require("./config/config.module");
const central_module_1 = require("./central/central.module");
const devices_module_1 = require("./devices/devices.module");
const health_module_1 = require("./health/health.module");
const outbox_module_1 = require("./outbox/outbox.module");
const donations_module_1 = require("./donations/donations.module");
const payments_module_1 = require("./payments/payments.module");
const tl3800_module_1 = require("./tl3800/tl3800.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_module_1.ConfigModule,
            outbox_module_1.OutboxModule,
            tl3800_module_1.TL3800Module,
            central_module_1.CentralModule,
            payments_module_1.PaymentsModule,
            donations_module_1.DonationsModule,
            devices_module_1.DevicesModule,
            health_module_1.HealthModule,
        ],
        providers: [
            {
                provide: core_1.APP_PIPE,
                useFactory: () => new common_2.ValidationPipe({
                    whitelist: true,
                    forbidNonWhitelisted: true,
                    transform: true,
                    transformOptions: { enableImplicitConversion: true },
                }),
            },
            {
                provide: core_1.APP_FILTER,
                useClass: all_exceptions_filter_1.AllExceptionsFilter,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map