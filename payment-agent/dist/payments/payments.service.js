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
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const central_payment_client_1 = require("../central/central-payment.client");
const tl3800_config_service_1 = require("../config/tl3800-config.service");
const tl3800_error_code_1 = require("../common/error-codes/tl3800-error-code");
const custom_exception_1 = require("../common/exceptions/custom.exception");
const response_parser_1 = require("../tl3800/builder/response.parser");
const tl3800_gateway_1 = require("../tl3800/gateway/tl3800.gateway");
const tl_transport_interface_1 = require("../tl3800/transport/tl-transport.interface");
const payment_status_enum_1 = require("./enum/payment-status.enum");
function isPaymentCancelError(err) {
    if (err instanceof tl_transport_interface_1.UserCancelledError)
        return true;
    if (err instanceof tl_transport_interface_1.TransportTimeoutError)
        return true;
    if (err instanceof Error && err.message.includes('follow-up window'))
        return true;
    return false;
}
let PaymentsService = PaymentsService_1 = class PaymentsService {
    gateway;
    parser;
    central;
    tl3800Config;
    logger = new common_1.Logger(PaymentsService_1.name);
    constructor(gateway, parser, central, tl3800Config) {
        this.gateway = gateway;
        this.parser = parser;
        this.central = central;
        this.tl3800Config = tl3800Config;
    }
    async approve(request) {
        await this.central.prepare({
            merchantUid: request.merchantUid,
            totalAmount: request.totalAmount,
            phoneNumber: request.phoneNumber,
            items: request.items,
        });
        this.central.notifyMessage('[TL3800] 단말기 결제 승인 요청');
        let packet;
        try {
            packet = await this.gateway.approve({ totalAmount: request.totalAmount });
        }
        catch (err) {
            const errorMessage = err.message;
            const isCancel = isPaymentCancelError(err);
            const paymentStatus = isCancel ? payment_status_enum_1.PaymentStatus.CANCEL : payment_status_enum_1.PaymentStatus.FAILED;
            this.central.notifyMessage(`[TL3800] 단말기 결제 승인 ${isCancel ? '취소' : '실패'}: ${errorMessage}`);
            const notifyResponse = {
                terminalId: this.tl3800Config.terminalId,
                paymentStatus,
                merchantUid: request.merchantUid,
                message: errorMessage,
            };
            await this.central.notifyApproveResult(notifyResponse);
            if (err instanceof tl_transport_interface_1.UserCancelledError) {
                throw new custom_exception_1.CustomException(tl3800_error_code_1.TL3800ErrorCode.PAYMENT_CANCELLED);
            }
            if (err instanceof Error && err.message.includes('follow-up window')) {
                throw new custom_exception_1.CustomException(tl3800_error_code_1.TL3800ErrorCode.TIMEOUT);
            }
            throw err;
        }
        if (this.parser.isDeclined(packet)) {
            const errorMessage = this.parser.getDeclineMessage(packet);
            this.logger.warn(`approve declined by bank: trxKind=X txId=${packet.dateTime14} msg="${errorMessage}"`);
            this.central.notifyMessage('[TL3800] 단말기 결제 승인 거절');
            const failedResponse = {
                terminalId: this.tl3800Config.terminalId,
                paymentStatus: payment_status_enum_1.PaymentStatus.FAILED,
                merchantUid: request.merchantUid,
                message: errorMessage,
            };
            await this.central.notifyApproveResult(failedResponse);
            throw new custom_exception_1.CustomException(tl3800_error_code_1.TL3800ErrorCode.APPROVAL_DECLINED);
        }
        let response;
        try {
            response = this.parser.parseApprove(packet, {
                phoneNumber: request.phoneNumber,
                items: request.items,
            });
        }
        catch (parseErr) {
            this.logger.error(`CRITICAL: card charged but response parse failed — notifying central with partial data: ${parseErr.message}`);
            const partialResponse = {
                terminalId: this.tl3800Config.terminalId,
                paymentStatus: payment_status_enum_1.PaymentStatus.COMPLETE,
                merchantUid: request.merchantUid,
                message: `결제 승인됨 (응답 파싱 오류: ${parseErr.message})`,
            };
            await this.central.notifyApproveResult(partialResponse);
            throw parseErr;
        }
        response.paymentStatus = payment_status_enum_1.PaymentStatus.COMPLETE;
        response.merchantUid = request.merchantUid;
        response.message = '결제 승인 성공';
        this.central.notifyMessage('[TL3800] 단말기 결제 승인 요청 성공');
        await this.central.notifyApproveResult(response);
        return response;
    }
    cancelPending() {
        const wasActive = this.gateway.cancelPending();
        return { cancelled: wasActive };
    }
    async cancel(request) {
        this.central.notifyMessage('[TL3800] 단말기 결제 취소 요청');
        const packet = await this.gateway.cancel(request).catch((err) => {
            this.central.notifyMessage(`[TL3800] 단말기 결제 취소 요청 실패: ${err.message}`);
            throw err;
        });
        if (packet.isFail()) {
            this.logger.warn(`cancel declined: responseCode=0x${packet.responseCode.toString(16)}`);
            this.central.notifyMessage('[TL3800] 단말기 결제 취소 거절');
            throw new custom_exception_1.CustomException(tl3800_error_code_1.TL3800ErrorCode.CANCEL_DECLINED);
        }
        const response = this.parser.parseCancel(packet);
        this.central.notifyMessage('[TL3800] 단말기 결제 취소 요청 성공');
        await this.central.notifyCancelResult(response);
        return response;
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tl3800_gateway_1.TL3800Gateway,
        response_parser_1.TL3800ResponseParser,
        central_payment_client_1.CentralPaymentClient,
        tl3800_config_service_1.TL3800ConfigService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map