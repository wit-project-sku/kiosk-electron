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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const base_response_dto_1 = require("../common/dto/base-response.dto");
const approve_request_dto_1 = require("./dto/approve-request.dto");
const cancel_request_dto_1 = require("./dto/cancel-request.dto");
const payments_service_1 = require("./payments.service");
let PaymentsController = class PaymentsController {
    service;
    constructor(service) {
        this.service = service;
    }
    async approve(request) {
        const result = await this.service.approve(request);
        return base_response_dto_1.BaseResponse.ok({ message: result.message ?? '결제 승인 성공' }, result.message ?? '결제 승인 성공');
    }
    cancelPending() {
        const data = this.service.cancelPending();
        const message = data.cancelled
            ? '결제 취소 요청이 전송되었습니다.'
            : '진행 중인 결제가 없습니다.';
        return base_response_dto_1.BaseResponse.ok({ message }, message);
    }
    async cancel(_paymentId, request) {
        const result = await this.service.cancel(request);
        const message = result.message ?? '결제 취소 성공';
        return base_response_dto_1.BaseResponse.ok({ message }, message);
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: '결제 승인', description: '키오스크 결제 승인 요청' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [approve_request_dto_1.ApproveRequestDto]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)('cancel-pending'),
    (0, swagger_1.ApiOperation)({ summary: '진행 중 결제 취소', description: '클라이언트에서 결제 진행 중 취소 요청' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", base_response_dto_1.BaseResponse)
], PaymentsController.prototype, "cancelPending", null);
__decorate([
    (0, common_1.Post)('dev/:paymentId/cancel'),
    (0, swagger_1.ApiOperation)({ summary: '[관리자] 결제 취소', description: '관리자 키오스크 결제 취소 요청' }),
    __param(0, (0, common_1.Param)('paymentId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, cancel_request_dto_1.CancelRequestDto]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "cancel", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, swagger_1.ApiTags)('결제'),
    (0, common_1.Controller)('api/payments'),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService])
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map