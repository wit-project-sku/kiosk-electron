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
exports.ApproveRequestDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const product_request_dto_1 = require("./product-request.dto");
class ApproveRequestDto {
    merchantUid;
    items;
    totalAmount;
    phoneNumber;
}
exports.ApproveRequestDto = ApproveRequestDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Merchant unique identifier', example: 'ORDER-20260430-001' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ApproveRequestDto.prototype, "merchantUid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [product_request_dto_1.ProductRequestDto], description: 'Items being paid for' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => product_request_dto_1.ProductRequestDto),
    __metadata("design:type", Array)
], ApproveRequestDto.prototype, "items", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Total amount in the terminal base currency', example: '10000' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.Matches)(/^\d{1,10}$/, { message: 'totalAmount must be 1–10 digits' }),
    __metadata("design:type", String)
], ApproveRequestDto.prototype, "totalAmount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Customer phone (10–11 digits)', example: '01012345678' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(/^\d{10,11}$/, { message: 'phoneNumber must be 10–11 digits' }),
    __metadata("design:type", String)
], ApproveRequestDto.prototype, "phoneNumber", void 0);
//# sourceMappingURL=approve-request.dto.js.map