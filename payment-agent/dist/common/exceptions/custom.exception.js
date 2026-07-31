"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomException = void 0;
const common_1 = require("@nestjs/common");
class CustomException extends common_1.HttpException {
    errorCode;
    constructor(errorCode) {
        super({ code: errorCode.code, message: errorCode.message, status: errorCode.status }, errorCode.status);
        this.errorCode = errorCode;
    }
}
exports.CustomException = CustomException;
//# sourceMappingURL=custom.exception.js.map