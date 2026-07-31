"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidJobCodeError = exports.JobCode = void 0;
exports.parseJobCode = parseJobCode;
exports.isKnownJobByte = isKnownJobByte;
exports.jobCodesMatch = jobCodesMatch;
exports.expectedResponseJob = expectedResponseJob;
var JobCode;
(function (JobCode) {
    JobCode["CHECK_DEVICE_REQ"] = "A";
    JobCode["CHECK_DEVICE_RES"] = "a";
    JobCode["APPROVE_REQ"] = "B";
    JobCode["APPROVE_RES"] = "b";
    JobCode["CANCEL_REQ"] = "C";
    JobCode["CANCEL_RES"] = "c";
    JobCode["REBOOT_REQ"] = "R";
    JobCode["EVENT"] = "@";
})(JobCode || (exports.JobCode = JobCode = {}));
const JOB_CODE_VALUES = new Set(Object.values(JobCode));
function parseJobCode(byte) {
    const ch = String.fromCharCode(byte & 0xff);
    if (!JOB_CODE_VALUES.has(ch)) {
        throw new InvalidJobCodeError(byte);
    }
    return ch;
}
function isKnownJobByte(byte) {
    return JOB_CODE_VALUES.has(String.fromCharCode(byte & 0xff));
}
function jobCodesMatch(expected, actual) {
    if (expected === actual)
        return true;
    if (expected === JobCode.EVENT || actual === JobCode.EVENT)
        return false;
    return expected.toLowerCase() === actual.toLowerCase();
}
function expectedResponseJob(req) {
    if (req >= 'A' && req <= 'Z') {
        const lower = req.toLowerCase();
        if (JOB_CODE_VALUES.has(lower))
            return lower;
    }
    return req;
}
class InvalidJobCodeError extends Error {
    constructor(byte) {
        super(`Invalid JobCode byte: 0x${byte.toString(16).padStart(2, '0').toUpperCase()}`);
        this.name = 'InvalidJobCodeError';
    }
}
exports.InvalidJobCodeError = InvalidJobCodeError;
//# sourceMappingURL=job-code.js.map