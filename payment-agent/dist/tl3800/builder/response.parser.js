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
var TL3800ResponseParser_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TL3800ResponseParser = void 0;
const common_1 = require("@nestjs/common");
const tl3800_config_service_1 = require("../../config/tl3800-config.service");
const tl3800_error_code_1 = require("../../common/error-codes/tl3800-error-code");
const proto_util_1 = require("../proto/proto.util");
class DataCursor {
    data;
    pos = 0;
    constructor(data) {
        this.data = data;
    }
    skip(n) {
        this.assert(n);
        this.pos += n;
    }
    takeAscii(n) {
        this.assert(n);
        const slice = this.data.subarray(this.pos, this.pos + n);
        this.pos += n;
        return (0, proto_util_1.asciiTrim)(Buffer.from(slice));
    }
    assert(n) {
        if (this.pos + n > this.data.length) {
            throw new RangeError(`Response payload too short: need ${n} bytes at offset ${this.pos}, have ${this.data.length - this.pos}`);
        }
    }
}
let TL3800ResponseParser = TL3800ResponseParser_1 = class TL3800ResponseParser {
    config;
    logger = new common_1.Logger(TL3800ResponseParser_1.name);
    constructor(config) {
        this.config = config;
    }
    isDeclined(packet) {
        return packet.data.length > 0 && packet.data[0] === 0x58;
    }
    getDeclineMessage(packet) {
        const OFFSET = 117;
        const LEN = 40;
        if (packet.data.length >= OFFSET + LEN) {
            return (0, proto_util_1.asciiTrim)(Buffer.from(packet.data.subarray(OFFSET, OFFSET + LEN)));
        }
        return tl3800_error_code_1.TL3800ErrorCode.APPROVAL_DECLINED.message;
    }
    parseApprove(packet, meta) {
        const c = new DataCursor(packet.data);
        const trxKindByte = packet.data[0];
        const trxKindChar = String.fromCharCode(trxKindByte);
        this.logger.log(`[parseApprove] trxKind=0x${trxKindByte.toString(16).padStart(2, '0')} ('${trxKindChar}') — ${trxKindChar === '0' ? '⚠ TEST/SIMULATION MODE' : 'real transaction'}`);
        c.skip(1);
        c.skip(1);
        const cardNumber = c.takeAscii(20);
        const totalAmount = stripLeadingZeros(c.takeAscii(10));
        c.skip(8);
        c.skip(8);
        c.skip(2);
        const approvalNumber = c.takeAscii(12);
        const approvedDate = c.takeAscii(8);
        const approvedTime = c.takeAscii(6);
        const transactionId = c.takeAscii(12);
        return {
            terminalId: this.config.terminalId,
            transactionId,
            approvedDate,
            approvedTime,
            totalAmount,
            approvalNumber,
            cardNumber,
            phoneNumber: meta.phoneNumber,
            items: meta.items,
        };
    }
    parseCancel(packet) {
        const c = new DataCursor(packet.data);
        c.skip(1);
        c.skip(1);
        const cardNumber = safe(() => c.takeAscii(20));
        const totalAmount = safe(() => stripLeadingZeros(c.takeAscii(10)));
        c.skip(8);
        c.skip(8);
        c.skip(2);
        const approvalNumber = safe(() => c.takeAscii(12));
        const approvedDate = safe(() => c.takeAscii(8));
        const approvedTime = safe(() => c.takeAscii(6));
        const transactionId = safe(() => c.takeAscii(12));
        return {
            terminalId: this.config.terminalId,
            transactionId,
            approvedDate,
            approvedTime,
            totalAmount,
            approvalNumber,
            cardNumber,
        };
    }
};
exports.TL3800ResponseParser = TL3800ResponseParser;
exports.TL3800ResponseParser = TL3800ResponseParser = TL3800ResponseParser_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tl3800_config_service_1.TL3800ConfigService])
], TL3800ResponseParser);
function stripLeadingZeros(s) {
    if (!s)
        return s;
    return s.replace(/^0+(?!$)/, '');
}
function safe(fn) {
    try {
        return fn();
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=response.parser.js.map