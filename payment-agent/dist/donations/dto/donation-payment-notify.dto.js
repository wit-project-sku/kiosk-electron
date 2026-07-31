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
exports.DonationPaymentNotifyDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const payment_status_enum_1 = require("../../payments/enum/payment-status.enum");
const payment_method_enum_1 = require("../enum/payment-method.enum");
class DonationPaymentNotifyDto {
    merchantUid;
    paymentStatus;
    paymentMethod;
    transactionId;
    approvalNumber;
    terminalId;
    cardNumber;
    message;
}
exports.DonationPaymentNotifyDto = DonationPaymentNotifyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'DONATION_20260518_001' }),
    __metadata("design:type", String)
], DonationPaymentNotifyDto.prototype, "merchantUid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: payment_status_enum_1.PaymentStatus }),
    __metadata("design:type", String)
], DonationPaymentNotifyDto.prototype, "paymentStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: payment_method_enum_1.PaymentMethod, example: payment_method_enum_1.PaymentMethod.CARD }),
    __metadata("design:type", String)
], DonationPaymentNotifyDto.prototype, "paymentMethod", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: '260518000015' }),
    __metadata("design:type", String)
], DonationPaymentNotifyDto.prototype, "transactionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: '25155007' }),
    __metadata("design:type", String)
], DonationPaymentNotifyDto.prototype, "approvalNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '7804097001' }),
    __metadata("design:type", String)
], DonationPaymentNotifyDto.prototype, "terminalId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: '0000536510631234' }),
    __metadata("design:type", String)
], DonationPaymentNotifyDto.prototype, "cardNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false, example: '정상처리' }),
    __metadata("design:type", String)
], DonationPaymentNotifyDto.prototype, "message", void 0);
//# sourceMappingURL=donation-payment-notify.dto.js.map