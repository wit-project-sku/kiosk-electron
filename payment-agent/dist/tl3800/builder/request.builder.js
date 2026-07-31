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
exports.TL3800RequestBuilder = void 0;
const common_1 = require("@nestjs/common");
const tl3800_config_service_1 = require("../../config/tl3800-config.service");
const tl_packet_1 = require("../packet/tl-packet");
const job_code_1 = require("../proto/job-code");
const proto_util_1 = require("../proto/proto.util");
let TL3800RequestBuilder = class TL3800RequestBuilder {
    config;
    constructor(config) {
        this.config = config;
    }
    checkDevice() {
        return new tl_packet_1.TLPacket('', (0, proto_util_1.nowYYYYMMDDhhmmss)(), job_code_1.JobCode.CHECK_DEVICE_REQ, 0x00, 0, Buffer.alloc(0));
    }
    rebootDevice() {
        return new tl_packet_1.TLPacket('', (0, proto_util_1.nowYYYYMMDDhhmmss)(), job_code_1.JobCode.REBOOT_REQ, 0x00, 0, Buffer.alloc(0));
    }
    approve(req) {
        const parts = [
            Buffer.from('1', 'ascii'),
            (0, proto_util_1.asciiLeftPadZero)(req.totalAmount, 10),
            (0, proto_util_1.asciiLeftPadZero)('', 8),
            (0, proto_util_1.asciiLeftPadZero)('', 8),
            (0, proto_util_1.asciiLeftPadZero)('', 2),
            Buffer.from('1', 'ascii'),
        ];
        const data = Buffer.concat(parts);
        if (data.length !== 30) {
            throw new Error(`approve payload must be 30 bytes, got ${data.length}`);
        }
        return new tl_packet_1.TLPacket(this.config.terminalId, (0, proto_util_1.nowYYYYMMDDhhmmss)(), job_code_1.JobCode.APPROVE_REQ, 0x00, 30, data);
    }
    cancel(req) {
        const originalDate = req.originalDate.replace(/-/g, '');
        const originalTime = req.originalTime.replace(/:/g, '');
        const parts = [
            Buffer.from(req.cancelType, 'ascii'),
            Buffer.from(req.transactionType, 'ascii'),
            (0, proto_util_1.asciiLeftPadZero)(req.cancelAmount, 10),
            (0, proto_util_1.asciiLeftPadZero)('0', 8),
            (0, proto_util_1.asciiLeftPadZero)('0', 8),
            (0, proto_util_1.asciiLeftPadZero)('00', 2),
            Buffer.from('1', 'ascii'),
            (0, proto_util_1.asciiRightPadSpace)(req.approvalNumber, 12),
            (0, proto_util_1.asciiLeftPadZero)(originalDate, 8),
            (0, proto_util_1.asciiLeftPadZero)(originalTime, 6),
            (0, proto_util_1.asciiLeftPadZero)('0', 2),
        ];
        const data = Buffer.concat(parts);
        if (data.length !== 59) {
            throw new Error(`cancel payload must be 59 bytes, got ${data.length}`);
        }
        return new tl_packet_1.TLPacket(this.config.terminalId, (0, proto_util_1.nowYYYYMMDDhhmmss)(), job_code_1.JobCode.CANCEL_REQ, 0x00, 59, data);
    }
};
exports.TL3800RequestBuilder = TL3800RequestBuilder;
exports.TL3800RequestBuilder = TL3800RequestBuilder = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tl3800_config_service_1.TL3800ConfigService])
], TL3800RequestBuilder);
//# sourceMappingURL=request.builder.js.map