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
var CentralPaymentClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CentralPaymentClient = void 0;
const axios_1 = require("@nestjs/axios");
const common_1 = require("@nestjs/common");
const axios_2 = require("axios");
const rxjs_1 = require("rxjs");
const outbox_service_1 = require("../outbox/outbox.service");
let CentralPaymentClient = CentralPaymentClient_1 = class CentralPaymentClient {
    http;
    outbox;
    logger = new common_1.Logger(CentralPaymentClient_1.name);
    constructor(http, outbox) {
        this.http = http;
        this.outbox = outbox;
    }
    async prepare(payload) {
        await this.post('/api/payments/prepare', payload);
        this.logger.log(`[central] /api/payments/prepare delivered (merchantUid=${payload.merchantUid})`);
    }
    async prepareDonation(payload) {
        await this.post('/api/donations/payments/prepare', payload);
        this.logger.log(`[central] /api/donations/payments/prepare delivered (merchantUid=${payload.merchantUid})`);
    }
    async notifyApproveResult(response) {
        const dedupeKey = response.transactionId
            ? `approve:${response.transactionId}`
            : `approve-fail:${response.merchantUid}:${Date.now()}`;
        await this.sendOrEnqueue(outbox_service_1.OutboxJobType.APPROVE, '/api/payments/approve', response, dedupeKey);
    }
    async notifyDonationApproveResult(response) {
        const dedupeKey = response.transactionId
            ? `donation-approve:${response.transactionId}`
            : `donation-approve-fail:${response.merchantUid}:${Date.now()}`;
        await this.sendOrEnqueue(outbox_service_1.OutboxJobType.DONATION_APPROVE, '/api/donations/payments/approve', response, dedupeKey);
    }
    async notifyCancelResult(response) {
        const dedupeKey = response.transactionId
            ? `cancel:${response.transactionId}`
            : `cancel-fail:${response.merchantUid ?? 'unknown'}:${Date.now()}`;
        await this.sendOrEnqueue(outbox_service_1.OutboxJobType.CANCEL, '/api/payments/cancel', response, dedupeKey);
    }
    notifyMessage(message) {
        void this.post('/api/devices', { message }).catch((err) => {
            this.logger.warn(`[central] notifyMessage failed: ${err.message} msg="${message}"`);
        });
    }
    async postRaw(uri, body) {
        await this.post(uri, body);
    }
    async sendOrEnqueue(type, uri, body, dedupeKey) {
        try {
            await this.post(uri, body);
            this.logger.log(`[central] ${uri} delivered inline`);
        }
        catch (err) {
            this.logger.error(`[central] ${uri} inline delivery failed — queuing for retry: ${err.message}`);
            this.outbox.enqueue({ type, uri, body, dedupeKey });
        }
    }
    async post(uri, body) {
        try {
            await (0, rxjs_1.firstValueFrom)(this.http.post(uri, body));
        }
        catch (err) {
            this.logCentralHttpError(uri, err);
            throw err;
        }
    }
    logCentralHttpError(uri, err) {
        if (!(err instanceof axios_2.AxiosError)) {
            this.logger.error(`[central] POST ${uri} failed: ${err.message}`);
            return;
        }
        const status = err.response?.status ?? 'NO_RESPONSE';
        const baseUrl = this.http.axiosRef.defaults.baseURL ?? '';
        const responseBody = summarizeResponseBody(err.response?.data);
        const authState = hasHeader(this.http.axiosRef.defaults.headers, 'authorization')
            ? 'present'
            : 'missing';
        this.logger.error(`[central] POST ${baseUrl}${uri} failed status=${status} auth=${authState} response=${responseBody}`);
    }
};
exports.CentralPaymentClient = CentralPaymentClient;
exports.CentralPaymentClient = CentralPaymentClient = CentralPaymentClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        outbox_service_1.OutboxService])
], CentralPaymentClient);
function summarizeResponseBody(data) {
    if (data === undefined || data === null)
        return '-';
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    return text.length > 500 ? `${text.slice(0, 500)}...` : text;
}
function hasHeader(headers, name) {
    if (!headers || typeof headers !== 'object')
        return false;
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === name)
            return true;
        if (value && typeof value === 'object' && hasHeader(value, name))
            return true;
    }
    return false;
}
//# sourceMappingURL=central-payment.client.js.map