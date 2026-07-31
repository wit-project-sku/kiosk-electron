"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodePacket = encodePacket;
const constants_1 = require("../proto/constants");
const proto_util_1 = require("../proto/proto.util");
function encodePacket(packet) {
    (0, proto_util_1.assertDateTime14)(packet.dateTime14);
    const dataLen = packet.dataLen;
    if (packet.data.length !== dataLen) {
        throw new RangeError(`data.length (${packet.data.length}) does not match dataLen (${dataLen})`);
    }
    const frame = Buffer.alloc(constants_1.HEADER_BYTES + dataLen + 2);
    let i = 0;
    frame[i++] = constants_1.STX;
    const catOrMid = packet.catOrMid ?? '';
    const idField = (0, proto_util_1.asciiLeftPadNul)(catOrMid, constants_1.CATMID_LEN);
    idField.copy(frame, constants_1.POS_CATMID);
    i += constants_1.CATMID_LEN;
    Buffer.from(packet.dateTime14, 'ascii').copy(frame, constants_1.POS_DT);
    i += constants_1.DATETIME_LEN;
    frame[i++] = packet.jobCode.charCodeAt(0);
    frame[i++] = packet.responseCode & 0xff;
    frame.writeUInt16LE(dataLen, i);
    i += 2;
    packet.data.copy(frame, i);
    i += dataLen;
    frame[i++] = constants_1.ETX;
    frame[i] = (0, proto_util_1.bccXor)(frame, 0, i - 1);
    return frame;
}
//# sourceMappingURL=packet-encoder.js.map