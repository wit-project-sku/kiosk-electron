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
exports.PacketResponseDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class PacketResponseDto {
    hex;
    jobCode;
    responseCode;
    message;
}
exports.PacketResponseDto = PacketResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Raw packet hex (for diagnostics)', required: false }),
    __metadata("design:type", String)
], PacketResponseDto.prototype, "hex", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'JobCode of the response', required: false }),
    __metadata("design:type", String)
], PacketResponseDto.prototype, "jobCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ResponseCode (0x00 = OK)', required: false }),
    __metadata("design:type", Number)
], PacketResponseDto.prototype, "responseCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Human-readable interpretation', required: false }),
    __metadata("design:type", String)
], PacketResponseDto.prototype, "message", void 0);
//# sourceMappingURL=packet-response.dto.js.map