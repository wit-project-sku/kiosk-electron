"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PacketParseError = void 0;
exports.parseStrict = parseStrict;
exports.parseLenient = parseLenient;
const constants_1 = require("../proto/constants");
const job_code_1 = require("../proto/job-code");
const proto_util_1 = require("../proto/proto.util");
const tl_packet_1 = require("./tl-packet");
class PacketParseError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PacketParseError';
    }
}
exports.PacketParseError = PacketParseError;
function parseStrict(frame) {
    if (!frame || frame.length < constants_1.HEADER_BYTES + 2) {
        throw new PacketParseError('Frame too short');
    }
    if (frame[POS_STX_ZERO] !== constants_1.STX) {
        throw new PacketParseError('STX mismatch');
    }
    const catOrMid = (0, proto_util_1.printableOrHex)(frame.subarray(constants_1.POS_CATMID, constants_1.POS_CATMID + constants_1.CATMID_LEN));
    const dateTime14 = frame
        .subarray(constants_1.POS_DT, constants_1.POS_DT + constants_1.DATETIME_LEN)
        .toString('ascii');
    const jobCode = (0, job_code_1.parseJobCode)(frame[constants_1.POS_JOB]);
    const responseCode = frame[constants_1.POS_RESP];
    const dataLen = frame.readUInt16LE(constants_1.POS_LEN);
    const etxPos = constants_1.HEADER_BYTES + dataLen;
    const bccPos = etxPos + 1;
    const expectedTotal = bccPos + 1;
    if (frame.length < expectedTotal) {
        throw new PacketParseError(`Frame incomplete: received=${frame.length} expected=${expectedTotal} (dataLen=${dataLen})`);
    }
    if (frame[etxPos] !== constants_1.ETX) {
        throw new PacketParseError(`ETX mismatch at pos ${etxPos}: got 0x${frame[etxPos].toString(16)}`);
    }
    const calcBcc = (0, proto_util_1.bccXor)(frame, 0, etxPos);
    const recvBcc = frame[bccPos];
    if (calcBcc !== recvBcc) {
        throw new PacketParseError(`BCC mismatch: calc=0x${calcBcc.toString(16)} recv=0x${recvBcc.toString(16)}`);
    }
    const data = Buffer.from(frame.subarray(constants_1.HEADER_BYTES, constants_1.HEADER_BYTES + dataLen));
    return new tl_packet_1.TLPacket(catOrMid, dateTime14, jobCode, responseCode, dataLen, data);
}
function parseLenient(frame) {
    if (frame.length < constants_1.HEADER_BYTES) {
        throw new PacketParseError('Frame shorter than header');
    }
    const catOrMid = (0, proto_util_1.printableOrHex)(frame.subarray(constants_1.POS_CATMID, constants_1.POS_CATMID + constants_1.CATMID_LEN));
    const dateTime14 = frame
        .subarray(constants_1.POS_DT, constants_1.POS_DT + constants_1.DATETIME_LEN)
        .toString('ascii');
    const jobCode = (0, job_code_1.parseJobCode)(frame[constants_1.POS_JOB]);
    const responseCode = frame[constants_1.POS_RESP];
    const dataLen = frame.readUInt16LE(constants_1.POS_LEN);
    const maxData = Math.max(0, frame.length - constants_1.HEADER_BYTES - 2);
    const actualLen = Math.min(dataLen, maxData);
    const data = Buffer.from(frame.subarray(constants_1.HEADER_BYTES, constants_1.HEADER_BYTES + actualLen));
    return new tl_packet_1.TLPacket(catOrMid, dateTime14, jobCode, responseCode, dataLen, data);
}
const POS_STX_ZERO = 0;
//# sourceMappingURL=packet-decoder.js.map