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
exports.DonationPaymentRequestDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const payment_method_enum_1 = require("../enum/payment-method.enum");
class DonationPaymentRequestDto {
    merchantUid;
    type;
    campaignId;
    totalAmount;
    paymentMethod;
}
exports.DonationPaymentRequestDto = DonationPaymentRequestDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'DONATION_20260518_001' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], DonationPaymentRequestDto.prototype, "merchantUid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'NGO', description: 'Donation type from frontend' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], DonationPaymentRequestDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], DonationPaymentRequestDto.prototype, "campaignId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Donation amount', example: 10000 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], DonationPaymentRequestDto.prototype, "totalAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: payment_method_enum_1.PaymentMethod, example: payment_method_enum_1.PaymentMethod.CARD }),
    (0, class_validator_1.IsEnum)(payment_method_enum_1.PaymentMethod),
    __metadata("design:type", String)
], DonationPaymentRequestDto.prototype, "paymentMethod", void 0);
//# sourceMappingURL=donation-payment-request.dto.js.map