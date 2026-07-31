"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_EVENT_SKIP = exports.MAX_DATA_LEN = exports.POS_LEN = exports.POS_RESP = exports.POS_JOB = exports.POS_DT = exports.POS_CATMID = exports.POS_STX = exports.DATETIME_LEN = exports.CATMID_LEN = exports.HEADER_BYTES = exports.NACK = exports.ACK = exports.ETX = exports.STX = void 0;
exports.STX = 0x02;
exports.ETX = 0x03;
exports.ACK = 0x06;
exports.NACK = 0x15;
exports.HEADER_BYTES = 35;
exports.CATMID_LEN = 16;
exports.DATETIME_LEN = 14;
exports.POS_STX = 0;
exports.POS_CATMID = 1;
exports.POS_DT = exports.POS_CATMID + exports.CATMID_LEN;
exports.POS_JOB = exports.POS_DT + exports.DATETIME_LEN;
exports.POS_RESP = exports.POS_JOB + 1;
exports.POS_LEN = exports.POS_RESP + 1;
exports.MAX_DATA_LEN = 4096;
exports.MAX_EVENT_SKIP = 5;
//# sourceMappingURL=constants.js.map