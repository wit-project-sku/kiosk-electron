"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalErrorCode = void 0;
const common_1 = require("@nestjs/common");
exports.GlobalErrorCode = {
    INVALID_INPUT_VALUE: {
        code: 'GLOBAL4001',
        message: '유효하지 않은 입력입니다.',
        status: common_1.HttpStatus.BAD_REQUEST,
    },
    RESOURCE_NOT_FOUND: {
        code: 'GLOBAL4002',
        message: '요청한 리소스를 찾을 수 없습니다.',
        status: common_1.HttpStatus.NOT_FOUND,
    },
    INTERNAL_SERVER_ERROR: {
        code: 'GLOBAL4003',
        message: '서버 내부 오류가 발생했습니다.',
        status: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
    },
};
//# sourceMappingURL=global-error-code.js.map