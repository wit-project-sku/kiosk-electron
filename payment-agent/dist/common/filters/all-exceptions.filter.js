"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AllExceptionsFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("axios");
const tl_transport_interface_1 = require("../../tl3800/transport/tl-transport.interface");
const global_error_code_1 = require("../error-codes/global-error-code");
const tl3800_error_code_1 = require("../error-codes/tl3800-error-code");
const custom_exception_1 = require("../exceptions/custom.exception");
let AllExceptionsFilter = AllExceptionsFilter_1 = class AllExceptionsFilter {
    logger = new common_1.Logger(AllExceptionsFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse();
        const { status, code, message, isClientError } = this.classify(exception);
        const log = `[${status}] ${code} ${message}`;
        if (isClientError) {
            this.logger.warn(log);
        }
        else {
            this.logger.error(log, exception?.stack);
        }
        res.status(status).json({
            success: false,
            code: status,
            errorCode: code,
            message,
        });
    }
    classify(exception) {
        if (exception instanceof custom_exception_1.CustomException) {
            return {
                status: exception.errorCode.status,
                code: exception.errorCode.code,
                message: exception.errorCode.message,
                isClientError: exception.errorCode.status < common_1.HttpStatus.INTERNAL_SERVER_ERROR,
            };
        }
        if (exception instanceof common_1.HttpException) {
            const status = exception.getStatus();
            const resp = exception.getResponse();
            const message = typeof resp === 'string'
                ? resp
                : resp?.message ||
                    exception.message;
            const flatMessage = Array.isArray(message) ? message.join('; ') : message;
            if (status === common_1.HttpStatus.BAD_REQUEST) {
                return {
                    status,
                    code: global_error_code_1.GlobalErrorCode.INVALID_INPUT_VALUE.code,
                    message: flatMessage || global_error_code_1.GlobalErrorCode.INVALID_INPUT_VALUE.message,
                    isClientError: true,
                };
            }
            if (status === common_1.HttpStatus.NOT_FOUND) {
                return {
                    status,
                    code: global_error_code_1.GlobalErrorCode.RESOURCE_NOT_FOUND.code,
                    message: flatMessage || global_error_code_1.GlobalErrorCode.RESOURCE_NOT_FOUND.message,
                    isClientError: true,
                };
            }
            return {
                status,
                code: `HTTP_${status}`,
                message: flatMessage || 'Request failed',
                isClientError: status < common_1.HttpStatus.INTERNAL_SERVER_ERROR,
            };
        }
        if (exception instanceof axios_1.AxiosError) {
            const upstreamStatus = exception.response?.status;
            return {
                status: common_1.HttpStatus.BAD_GATEWAY,
                code: upstreamStatus ? `CENTRAL_${upstreamStatus}` : 'CENTRAL_NO_RESPONSE',
                message: upstreamStatus
                    ? `Central server request failed with status ${upstreamStatus}`
                    : 'Central server did not respond',
                isClientError: false,
            };
        }
        if (exception instanceof tl_transport_interface_1.UserCancelledError) {
            return {
                status: tl3800_error_code_1.TL3800ErrorCode.PAYMENT_CANCELLED.status,
                code: tl3800_error_code_1.TL3800ErrorCode.PAYMENT_CANCELLED.code,
                message: tl3800_error_code_1.TL3800ErrorCode.PAYMENT_CANCELLED.message,
                isClientError: true,
            };
        }
        if (exception instanceof tl_transport_interface_1.TransportTimeoutError) {
            return {
                status: tl3800_error_code_1.TL3800ErrorCode.TIMEOUT.status,
                code: tl3800_error_code_1.TL3800ErrorCode.TIMEOUT.code,
                message: exception.message || tl3800_error_code_1.TL3800ErrorCode.TIMEOUT.message,
                isClientError: false,
            };
        }
        if (exception instanceof Error) {
            const isTl3800 = /TL3800|serial|ACK|NACK|BCC|STX|ETX/i.test(exception.message);
            if (isTl3800) {
                return {
                    status: tl3800_error_code_1.TL3800ErrorCode.COMMUNICATION_ERROR.status,
                    code: tl3800_error_code_1.TL3800ErrorCode.COMMUNICATION_ERROR.code,
                    message: exception.message,
                    isClientError: false,
                };
            }
        }
        return {
            status: global_error_code_1.GlobalErrorCode.INTERNAL_SERVER_ERROR.status,
            code: global_error_code_1.GlobalErrorCode.INTERNAL_SERVER_ERROR.code,
            message: exception?.message || global_error_code_1.GlobalErrorCode.INTERNAL_SERVER_ERROR.message,
            isClientError: false,
        };
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = AllExceptionsFilter_1 = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map