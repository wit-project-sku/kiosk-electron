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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TL3800Gateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TL3800Gateway = void 0;
const common_1 = require("@nestjs/common");
const async_mutex_1 = require("async-mutex");
const tl3800_config_service_1 = require("../../config/tl3800-config.service");
const request_builder_1 = require("../builder/request.builder");
const tl3800_client_1 = require("../client/tl3800.client");
const tl_transport_interface_1 = require("../transport/tl-transport.interface");
let TL3800Gateway = TL3800Gateway_1 = class TL3800Gateway {
    transport;
    client;
    builder;
    config;
    logger = new common_1.Logger(TL3800Gateway_1.name);
    mutex = new async_mutex_1.Mutex();
    cancelRequested = false;
    verifiedPath = null;
    verifiedBaud = null;
    constructor(transport, client, builder, config) {
        this.transport = transport;
        this.client = client;
        this.builder = builder;
        this.config = config;
    }
    cancelPending() {
        const wasActive = this.mutex.isLocked();
        this.cancelRequested = true;
        return wasActive;
    }
    async checkDevice() {
        return this.call(() => this.builder.checkDevice());
    }
    async rebootDevice() {
        return this.call(() => this.builder.rebootDevice());
    }
    async approve(req) {
        return this.call(() => this.builder.approve(req));
    }
    async cancel(req) {
        return this.call(() => this.builder.cancel(req));
    }
    async openConnection() {
        if (this.verifiedPath) {
            try {
                await this.transport.open(this.verifiedPath, this.verifiedBaud ? { baudRate: this.verifiedBaud } : undefined);
                return;
            }
            catch (err) {
                this.logger.warn(`verified port ${this.verifiedPath} failed to open (${err.message}) — re-scanning`);
                this.verifiedPath = null;
                this.verifiedBaud = null;
            }
        }
        const candidates = await this.transport.listCandidatePorts();
        const fallbackBauds = this.config.baudFallbacks;
        if (candidates.length === 0) {
            await this.transport.open();
            this.verifiedPath = this.transport.currentPath();
            return;
        }
        if (candidates.length === 1 && fallbackBauds.length === 0) {
            await this.transport.open(candidates[0]);
            this.verifiedPath = this.transport.currentPath();
            return;
        }
        const bauds = [undefined, ...fallbackBauds];
        this.logger.warn(`Probing for the TL-3800: ports [${candidates.join(', ')}] × bauds [${bauds
            .map((b) => b ?? `${this.config.baudRate}(configured)`)
            .join(', ')}] via checkDevice handshake.`);
        for (const baud of bauds) {
            for (const path of candidates) {
                const baudLabel = baud ?? this.config.baudRate;
                try {
                    await this.transport.open(path, baud ? { baudRate: baud } : undefined);
                    await this.transport.drainInputBuffer(200);
                    await this.client.requestResponse(this.builder.checkDevice(), () => false);
                    this.logger.log(`✔ TL-3800 answered on ${path} @ ${baudLabel}bps — using it for this session.`);
                    if (baud) {
                        this.logger.warn(`↳ terminal is NOT at the configured baud — set TL3800_BAUD_RATE=${baud} to skip probing next time.`);
                    }
                    this.verifiedPath = path;
                    this.verifiedBaud = baud ?? null;
                    return;
                }
                catch (err) {
                    this.logger.warn(`✗ ${path} @ ${baudLabel}bps: ${err.message}`);
                    await this.transport.close().catch(() => undefined);
                }
            }
        }
        throw new Error(`No TL-3800 responded on any candidate port (${candidates.join(', ')}) at bauds ` +
            `[${bauds.map((b) => b ?? this.config.baudRate).join(', ')}]. ` +
            `Check the terminal power/cable, or pin TL3800_PORT / TL3800_BAUD_RATE explicitly.`);
    }
    async call(build) {
        return this.mutex.runExclusive(async () => {
            this.cancelRequested = false;
            try {
                await this.openConnection();
                await this.transport.drainInputBuffer(250);
                const packet = build();
                return await this.client.requestResponse(packet, () => this.cancelRequested);
            }
            catch (err) {
                if (!(err instanceof tl_transport_interface_1.UserCancelledError)) {
                    this.verifiedPath = null;
                    this.verifiedBaud = null;
                }
                this.logger.error(`TL3800 transaction failed: ${err.message}`);
                throw err;
            }
            finally {
                try {
                    await this.transport.close();
                }
                catch (closeErr) {
                    this.logger.warn(`failed to close serial port: ${closeErr.message}`);
                }
            }
        });
    }
};
exports.TL3800Gateway = TL3800Gateway;
exports.TL3800Gateway = TL3800Gateway = TL3800Gateway_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(tl_transport_interface_1.TL_TRANSPORT)),
    __metadata("design:paramtypes", [Object, tl3800_client_1.TL3800Client,
        request_builder_1.TL3800RequestBuilder,
        tl3800_config_service_1.TL3800ConfigService])
], TL3800Gateway);
//# sourceMappingURL=tl3800.gateway.js.map