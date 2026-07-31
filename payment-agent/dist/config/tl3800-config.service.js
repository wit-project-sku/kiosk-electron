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
exports.TL3800ConfigService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let TL3800ConfigService = class TL3800ConfigService {
    config;
    constructor(config) {
        this.config = config;
    }
    get terminalId() {
        return this.config.getOrThrow('TL3800_TERMINAL_ID');
    }
    get logConfigDiscovery() {
        return this.config.get('TL3800_LOG_CONFIG_DISCOVERY') ?? false;
    }
    get port() {
        return this.config.get('TL3800_PORT');
    }
    get baudRate() {
        return this.config.getOrThrow('TL3800_BAUD_RATE');
    }
    get baudFallbacks() {
        const raw = this.config.get('TL3800_BAUD_FALLBACKS') ?? '';
        return raw
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => Number.isFinite(n) && n > 0);
    }
    get dataBits() {
        return this.config.getOrThrow('TL3800_DATA_BITS');
    }
    get stopBits() {
        return this.config.getOrThrow('TL3800_STOP_BITS');
    }
    get parity() {
        return this.config.getOrThrow('TL3800_PARITY');
    }
    get ackWaitMs() {
        return this.config.getOrThrow('TL3800_ACK_WAIT_MS');
    }
    get respWaitMs() {
        return this.config.getOrThrow('TL3800_RESP_WAIT_MS');
    }
    get maxAckRetry() {
        return this.config.getOrThrow('TL3800_MAX_ACK_RETRY');
    }
    get followupWindowMs() {
        return this.config.getOrThrow('TL3800_FOLLOWUP_WINDOW_MS');
    }
};
exports.TL3800ConfigService = TL3800ConfigService;
exports.TL3800ConfigService = TL3800ConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], TL3800ConfigService);
//# sourceMappingURL=tl3800-config.service.js.map