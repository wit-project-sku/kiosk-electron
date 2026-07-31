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
exports.BaseResponse = void 0;
const swagger_1 = require("@nestjs/swagger");
class BaseResponse {
    success;
    code;
    message;
    data;
    static ok(data, message = '요청이 성공적으로 처리되었습니다.') {
        const res = new BaseResponse();
        res.success = true;
        res.code = 200;
        res.message = message;
        res.data = data;
        return res;
    }
}
exports.BaseResponse = BaseResponse;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], BaseResponse.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 200 }),
    __metadata("design:type", Number)
], BaseResponse.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '요청이 성공적으로 처리되었습니다.' }),
    __metadata("design:type", String)
], BaseResponse.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ required: false }),
    __metadata("design:type", Object)
], BaseResponse.prototype, "data", void 0);
//# sourceMappingURL=base-response.dto.js.map