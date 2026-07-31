"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asciiLeftPadZero = asciiLeftPadZero;
exports.asciiLeftPadNul = asciiLeftPadNul;
exports.asciiRightPadSpace = asciiRightPadSpace;
exports.nowYYYYMMDDhhmmss = nowYYYYMMDDhhmmss;
exports.bccXor = bccXor;
exports.toHex = toHex;
exports.asciiTrim = asciiTrim;
exports.hexDump = hexDump;
exports.isPrintableAscii = isPrintableAscii;
exports.printableOrHex = printableOrHex;
exports.assertDateTime14 = assertDateTime14;
const constants_1 = require("./constants");
function asciiLeftPadZero(value, len) {
    const src = Buffer.from(value ?? '', 'ascii');
    if (src.length > len) {
        throw new RangeError(`Value "${value}" (${src.length} bytes) exceeds field width ${len}`);
    }
    const out = Buffer.alloc(len, 0x30);
    src.copy(out, len - src.length);
    return out;
}
function asciiLeftPadNul(value, len) {
    const src = Buffer.from(value ?? '', 'ascii');
    if (src.length > len) {
        throw new RangeError(`Value "${value}" (${src.length} bytes) exceeds field width ${len}`);
    }
    const out = Buffer.alloc(len, 0x00);
    src.copy(out, 0);
    return out;
}
function asciiRightPadSpace(value, len) {
    const src = Buffer.from(value ?? '', 'ascii');
    if (src.length > len) {
        throw new RangeError(`Value "${value}" (${src.length} bytes) exceeds field width ${len}`);
    }
    const out = Buffer.alloc(len, 0x20);
    src.copy(out, 0);
    return out;
}
function nowYYYYMMDDhhmmss(now = new Date()) {
    const pad = (n, w = 2) => n.toString().padStart(w, '0');
    return (pad(now.getFullYear(), 4) +
        pad(now.getMonth() + 1) +
        pad(now.getDate()) +
        pad(now.getHours()) +
        pad(now.getMinutes()) +
        pad(now.getSeconds()));
}
function bccXor(buf, from, toInclusive) {
    let x = 0;
    for (let i = from; i <= toInclusive; i++) {
        x ^= buf[i];
    }
    return x & 0xff;
}
function toHex(buf) {
    if (!buf || buf.length === 0)
        return '';
    const out = [];
    for (let i = 0; i < buf.length; i++) {
        out.push(buf[i].toString(16).padStart(2, '0').toUpperCase());
    }
    return out.join(' ');
}
function asciiTrim(buf) {
    return buf.toString('ascii').replace(/\u0000+$/, '').trim();
}
function hexDump(buf, bytesPerRow = 16) {
    if (!buf || buf.length === 0)
        return '(empty)';
    const rows = [];
    for (let off = 0; off < buf.length; off += bytesPerRow) {
        const slice = buf.subarray(off, off + bytesPerRow);
        const hex = [];
        let ascii = '';
        for (let i = 0; i < bytesPerRow; i++) {
            if (i < slice.length) {
                const b = slice[i];
                hex.push(b.toString(16).padStart(2, '0').toUpperCase());
                ascii += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.';
            }
            else {
                hex.push('  ');
                ascii += ' ';
            }
        }
        rows.push(`${off.toString().padStart(4, ' ')} | ${hex.join(' ')} | ${ascii}`);
    }
    return rows.join('\n');
}
function isPrintableAscii(bytes) {
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        if (b === 0x00)
            continue;
        if (b < 0x20 || b > 0x7e)
            return false;
    }
    return true;
}
function printableOrHex(buf) {
    if (!buf || buf.length === 0)
        return '';
    if (isPrintableAscii(buf))
        return asciiTrim(buf);
    return toHex(buf);
}
function assertDateTime14(dt) {
    if (!dt || dt.length !== constants_1.DATETIME_LEN || !/^\d{14}$/.test(dt)) {
        throw new RangeError(`dateTime14 must be 14 digits (YYYYMMDDhhmmss), got "${dt}"`);
    }
}
//# sourceMappingURL=proto.util.js.map