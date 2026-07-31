"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TLPacket = void 0;
exports.createTLPacket = createTLPacket;
class TLPacket {
    catOrMid;
    dateTime14;
    jobCode;
    responseCode;
    dataLen;
    data;
    constructor(catOrMid, dateTime14, jobCode, responseCode, dataLen, data) {
        this.catOrMid = catOrMid;
        this.dateTime14 = dateTime14;
        this.jobCode = jobCode;
        this.responseCode = responseCode;
        this.dataLen = dataLen;
        this.data = data;
        Object.freeze(this);
    }
    isFail() {
        return this.responseCode !== 0x00;
    }
}
exports.TLPacket = TLPacket;
function createTLPacket(init) {
    return new TLPacket(init.catOrMid ?? '', init.dateTime14, init.jobCode, init.responseCode ?? 0x00, init.dataLen, init.data);
}
//# sourceMappingURL=tl-packet.js.map