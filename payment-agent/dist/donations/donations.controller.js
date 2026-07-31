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
var DonationsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DonationsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const base_response_dto_1 = require("../common/dto/base-response.dto");
const donation_payment_request_dto_1 = require("./dto/donation-payment-request.dto");
const donations_service_1 = require("./donations.service");
let DonationsController = DonationsController_1 = class DonationsController {
    service;
    logger = new common_1.Logger(DonationsController_1.name);
    constructor(service) {
        this.service = service;
    }
    async pay(request) {
        this.logger.log(`[donation-pay] incoming payload: ${JSON.stringify(request)}`);
        try {
            const result = await this.service.pay(request);
            return base_response_dto_1.BaseResponse.ok({ message: result.message ?? '기부 결제 성공' }, result.message ?? '기부 결제 성공');
        }
        catch (err) {
            const error = err;
            this.logger.error(`[donation-pay] failed payload=${JSON.stringify(request)} message="${error.message}"`, error.stack);
            throw err;
        }
    }
    cancelPending() {
        const data = this.service.cancelPending();
        const message = data.cancelled
            ? 'Donation payment cancel request sent.'
            : 'No donation payment is currently in progress.';
        return base_response_dto_1.BaseResponse.ok({ message }, message);
    }
};
exports.DonationsController = DonationsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({
        summary: '기부 결제',
        description: '웹에서 기부 결제 요청 — central prepare 후 TL-3800 승인, 완료 시 central approve',
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [donation_payment_request_dto_1.DonationPaymentRequestDto]),
    __metadata("design:returntype", Promise)
], DonationsController.prototype, "pay", null);
__decorate([
    (0, common_1.Post)('cancel-pending'),
    (0, swagger_1.ApiOperation)({
        summary: 'Donation payment cancel pending',
        description: 'Cancel an in-progress donation payment request from the donation screen.',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", base_response_dto_1.BaseResponse)
], DonationsController.prototype, "cancelPending", null);
exports.DonationsController = DonationsController = DonationsController_1 = __decorate([
    (0, swagger_1.ApiTags)('기부'),
    (0, common_1.Controller)('api/donations/payments'),
    __metadata("design:paramtypes", [donations_service_1.DonationsService])
], DonationsController);
//# sourceMappingURL=donations.controller.js.map