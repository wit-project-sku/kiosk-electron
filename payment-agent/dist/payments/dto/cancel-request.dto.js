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
exports.CancelRequestDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CancelRequestDto {
    cancelType;
    transactionType;
    cancelAmount;
    approvalNumber;
    originalDate;
    originalTime;
}
exports.CancelRequestDto = CancelRequestDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Cancel type (1=void, 2=refund)', example: '1' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^[12]$/),
    __metadata("design:type", String)
], CancelRequestDto.prototype, "cancelType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Transaction type (1=credit card, …)', example: '1' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d$/),
    __metadata("design:type", String)
], CancelRequestDto.prototype, "transactionType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Amount to cancel', example: '10000' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{1,10}$/),
    __metadata("design:type", String)
], CancelRequestDto.prototype, "cancelAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Original approval number (up to 12 chars)', example: '12345678' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CancelRequestDto.prototype, "approvalNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Original approval date YYYYMMDD or YYYY-MM-DD', example: '20260422' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{4}-?\d{2}-?\d{2}$/),
    __metadata("design:type", String)
], CancelRequestDto.prototype, "originalDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Original approval time HHmmss or HH:mm:ss', example: '123045' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{2}:?\d{2}:?\d{2}$/),
    __metadata("design:type", String)
], CancelRequestDto.prototype, "originalTime", void 0);
//# sourceMappingURL=cancel-request.dto.js.map