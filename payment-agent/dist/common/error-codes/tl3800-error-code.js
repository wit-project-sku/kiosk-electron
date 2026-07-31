"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TL3800ErrorCode = void 0;
const common_1 = require("@nestjs/common");
exports.TL3800ErrorCode = {
    APPROVAL_DECLINED: {
        code: 'TL3800_4001',
        message: '단말기 결제가 거절되었습니다.',
        status: common_1.HttpStatus.BAD_REQUEST,
    },
    CANCEL_DECLINED: {
        code: 'TL3800_4002',
        message: '단말기 결제 취소가 거절되었습니다.',
        status: common_1.HttpStatus.BAD_REQUEST,
    },
    PAYMENT_CANCELLED: {
        code: 'TL3800_4003',
        message: '결제가 취소되었습니다.',
        status: common_1.HttpStatus.BAD_REQUEST,
    },
    COMMUNICATION_ERROR: {
        code: 'TL3800_5001',
        message: '단말기 통신 중 오류가 발생했습니다.',
        status: common_1.HttpStatus.SERVICE_UNAVAILABLE,
    },
    TIMEOUT: {
        code: 'TL3800_5002',
        message: '단말기 응답 대기 시간을 초과했습니다.',
        status: common_1.HttpStatus.GATEWAY_TIMEOUT,
    },
};
//# sourceMappingURL=tl3800-error-code.js.map