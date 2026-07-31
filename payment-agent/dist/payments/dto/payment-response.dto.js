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
exports.PaymentResponseDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const payment_status_enum_1 = require("../enum/payment-status.enum");
const product_request_dto_1 = require("./product-request.dto");
class PaymentResponseDto {
    terminalId;
    paymentStatus;
    merchantUid;
    message;
    transactionId;
    approvedDate;
    approvedTime;
    totalAmount;
    approvalNumber;
    cardNumber;
    phoneNumber;
    items;
}
exports.PaymentResponseDto = PaymentResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Terminal ID (CAT/MID)', example: '7804097001' }),
    __metadata("design:type", String)
], PaymentResponseDto.prototype, "terminalId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: payment_status_enum_1.PaymentStatus, description: 'Payment status', required: false }),
    __metadata("design:type", String)
], PaymentResponseDto.prototype, "paymentStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Merchant unique identifier', example: 'ORDER-20260430-001', required: false }),
    __metadata("design:type", String)
], PaymentResponseDto.prototype, "merchantUid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Result message', required: false }),
    __metadata("design:type", String)
], PaymentResponseDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'VAN transaction id', example: '000123456789', required: false }),
    __metadata("design:type", String)
], PaymentResponseDto.prototype, "transactionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'YYYYMMDD', example: '20260422', required: false }),
    __metadata("design:type", String)
], PaymentResponseDto.prototype, "approvedDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'HHmmss', example: '123045', required: false }),
    __metadata("design:type", String)
], PaymentResponseDto.prototype, "approvedTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '10000', required: false }),
    __metadata("design:type", String)
], PaymentResponseDto.prototype, "totalAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '12345678', required: false }),
    __metadata("design:type", String)
], PaymentResponseDto.prototype, "approvalNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Masked PAN as returned by terminal',
        example: '1234-****-****-5678',
        required: false,
    }),
    __metadata("design:type", String)
], PaymentResponseDto.prototype, "cardNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    __metadata("design:type", String)
], PaymentResponseDto.prototype, "phoneNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [product_request_dto_1.ProductRequestDto], required: false }),
    __metadata("design:type", Array)
], PaymentResponseDto.prototype, "items", void 0);
//# sourceMappingURL=payment-response.dto.js.map