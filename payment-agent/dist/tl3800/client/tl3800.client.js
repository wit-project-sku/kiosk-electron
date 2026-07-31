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
var TL3800Client_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TL3800Client = void 0;
const common_1 = require("@nestjs/common");
const tl3800_config_service_1 = require("../../config/tl3800-config.service");
const packet_encoder_1 = require("../packet/packet-encoder");
const packet_decoder_1 = require("../packet/packet-decoder");
const tl_packet_1 = require("../packet/tl-packet");
const constants_1 = require("../proto/constants");
const job_code_1 = require("../proto/job-code");
const proto_util_1 = require("../proto/proto.util");
const tl_transport_interface_1 = require("../transport/tl-transport.interface");
let TL3800Client = TL3800Client_1 = class TL3800Client {
    transport;
    config;
    logger = new common_1.Logger(TL3800Client_1.name);
    constructor(transport, config) {
        this.transport = transport;
        this.config = config;
    }
    async requestResponse(requestPacket, isCancelled) {
        const frame = (0, packet_encoder_1.encodePacket)(requestPacket);
        this.logger.log(`>> TX job=${requestPacket.jobCode} len=${frame.length} HEX=${(0, proto_util_1.toHex)(frame)}`);
        const expected = (0, job_code_1.expectedResponseJob)(requestPacket.jobCode);
        let ackTries = 0;
        for (;;) {
            await this.transport.write(frame);
            await this.sleep(10);
            const ack = await this.waitForAckNack(this.config.ackWaitMs);
            if (ack === null)
                throw new Error('ACK/NACK wait timeout');
            if (ack === constants_1.NACK) {
                ackTries++;
                if (ackTries > this.config.maxAckRetry) {
                    throw new Error(`NACK received (max retries exceeded: ${ackTries - 1})`);
                }
                this.logger.warn(`<< NACK — retrying ${ackTries}/${this.config.maxAckRetry}`);
                continue;
            }
            if (ack !== constants_1.ACK) {
                throw new Error(`Unknown control byte: 0x${ack.toString(16).padStart(2, '0')}`);
            }
            this.logger.log('<< ACK received');
            const response = await this.readFinalResponse(expected, isCancelled);
            if (response)
                return response;
            throw new Error('No response frame received within follow-up window');
        }
    }
    async readFinalResponse(expected, isCancelled) {
        const overallDeadline = Date.now() + this.config.followupWindowMs;
        let eventCount = 0;
        while (Date.now() < overallDeadline) {
            const remaining = overallDeadline - Date.now();
            const perTry = Math.min(this.config.respWaitMs, remaining);
            let packet;
            try {
                packet = await this.readOneFrame(perTry, isCancelled);
            }
            catch (err) {
                if (err instanceof tl_transport_interface_1.UserCancelledError)
                    throw err;
                if (err instanceof tl_transport_interface_1.TransportTimeoutError) {
                    this.logger.debug(`frame read per-try timeout (${perTry}ms) — waiting more`);
                    continue;
                }
                if (err instanceof packet_decoder_1.PacketParseError) {
                    this.logger.warn(`parse error — resyncing on next STX: ${err.message}`);
                    continue;
                }
                throw err;
            }
            if (packet.jobCode === job_code_1.JobCode.EVENT) {
                eventCount++;
                this.logger.log(`<< EVENT (${eventCount}/${constants_1.MAX_EVENT_SKIP}) — consuming`);
                if (eventCount >= constants_1.MAX_EVENT_SKIP) {
                    throw new Error('Too many consecutive EVENT frames');
                }
                continue;
            }
            if (!(0, job_code_1.jobCodesMatch)(expected, packet.jobCode)) {
                this.logger.warn(`unexpected job=${packet.jobCode} (expected=${expected}) — keep waiting`);
                continue;
            }
            return packet;
        }
        return null;
    }
    async readOneFrame(perTryMs, isCancelled) {
        const deadline = Date.now() + perTryMs;
        for (;;) {
            const left = deadline - Date.now();
            if (left <= 0)
                throw new tl_transport_interface_1.TransportTimeoutError('STX scan timeout');
            const b = await this.transport.readByte(Math.min(200, left));
            if (b < 0) {
                if (isCancelled?.())
                    throw new tl_transport_interface_1.UserCancelledError();
                continue;
            }
            if (b !== constants_1.STX) {
                this.logger.debug(`ignored byte 0x${b.toString(16).padStart(2, '0')}`);
                continue;
            }
            const rest = await this.transport.readFully(constants_1.HEADER_BYTES - 1, Math.max(50, deadline - Date.now()));
            const header = Buffer.concat([Buffer.from([constants_1.STX]), rest]);
            normalizeIdPadding(header);
            if (!isSaneHeader(header)) {
                this.logger.warn(`header sanity failed — resync: HEX=${(0, proto_util_1.toHex)(header)}`);
                continue;
            }
            const jobByte = header[constants_1.POS_JOB];
            const dataLen = header.readUInt16LE(constants_1.POS_LEN);
            if (jobByte === job_code_1.JobCode.EVENT.charCodeAt(0)) {
                const tail = await this.transport.readFully(dataLen + 2, this.config.respWaitMs);
                this.logger.debug(`<< EVENT consumed dataLen=${dataLen} tail=${(0, proto_util_1.toHex)(tail)}`);
                return new tl_packet_1.TLPacket('', '', job_code_1.JobCode.EVENT, 0x00, dataLen, Buffer.alloc(0));
            }
            const tail = await this.transport.readFully(dataLen + 2, this.config.respWaitMs);
            const full = Buffer.concat([header, tail]);
            let packet;
            try {
                packet = (0, packet_decoder_1.parseStrict)(full);
                this.logger.log(`<< RX job=${packet.jobCode} len=${full.length} HEX=${(0, proto_util_1.toHex)(full)}`);
            }
            catch (err) {
                this.logger.warn(`strict parse failed — trying lenient: ${err.message}`);
                try {
                    packet = (0, packet_decoder_1.parseLenient)(full);
                }
                catch {
                    await this.sendControlByte(constants_1.NACK);
                    throw err;
                }
            }
            this.logConfigDiscovery(packet);
            await this.sendControlByte(constants_1.ACK);
            return packet;
        }
    }
    logConfigDiscovery(packet) {
        if (!this.config.logConfigDiscovery)
            return;
        const headerId = packet.catOrMid;
        this.logger.log([
            '',
            `════════ TL3800 CONFIG DISCOVERY (job=${packet.jobCode}) ════════`,
            `configured TL3800_TERMINAL_ID = ${this.config.terminalId}`,
            `header CAT/MID field          = "${headerId}" (len=${headerId.length})`,
            `data length                   = ${packet.data.length} bytes`,
            'DATA (offset | hex | ascii):',
            (0, proto_util_1.hexDump)(packet.data),
            'Read these off the ASCII column / device settings slip:',
            '  ❑ Terminal ID(단말기번호)  ❑ Merchant ID(가맹점번호)  ❑ VAN(VAN사)  ❑ Store No.(매장번호)',
            '══════════════════════════════════════════════════════',
        ].join('\n'));
    }
    async waitForAckNack(timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const b = await this.transport.readByte(Math.min(50, deadline - Date.now()));
            if (b < 0)
                continue;
            if (b === constants_1.ACK || b === constants_1.NACK)
                return b;
            this.logger.debug(`ignored control byte 0x${b.toString(16).padStart(2, '0')}`);
        }
        this.logger.warn(`ACK/NACK timeout (${timeoutMs}ms)`);
        return null;
    }
    async sendControlByte(b) {
        try {
            await this.transport.write(Buffer.from([b]));
            this.logger.log(`>> ${b === constants_1.ACK ? 'ACK' : b === constants_1.NACK ? 'NACK' : `0x${b.toString(16)}`}`);
        }
        catch (err) {
            this.logger.warn(`failed to send control byte: ${err.message}`);
        }
    }
    sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }
};
exports.TL3800Client = TL3800Client;
exports.TL3800Client = TL3800Client = TL3800Client_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(tl_transport_interface_1.TL_TRANSPORT)),
    __metadata("design:paramtypes", [Object, tl3800_config_service_1.TL3800ConfigService])
], TL3800Client);
function normalizeIdPadding(header) {
    for (let i = 1; i <= 16; i++) {
        if (header[i] === 0x20)
            header[i] = 0x00;
    }
}
function isSaneHeader(header) {
    if (!header || header.length < constants_1.HEADER_BYTES)
        return false;
    for (let i = 1; i < constants_1.POS_DT; i++) {
        const v = header[i];
        if (v !== 0x00 && (v < 0x30 || v > 0x39))
            return false;
    }
    for (let i = constants_1.POS_DT; i < constants_1.POS_DT + constants_1.DATETIME_LEN; i++) {
        const v = header[i];
        if (v < 0x30 || v > 0x39)
            return false;
    }
    if (!(0, job_code_1.isKnownJobByte)(header[constants_1.POS_JOB]))
        return false;
    try {
        (0, job_code_1.parseJobCode)(header[constants_1.POS_JOB]);
    }
    catch {
        return false;
    }
    const dataLen = header.readUInt16LE(constants_1.POS_LEN);
    if (dataLen > constants_1.MAX_DATA_LEN)
        return false;
    return true;
}
//# sourceMappingURL=tl3800.client.js.map