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
var SerialPortTransport_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SerialPortTransport = void 0;
const node_fs_1 = require("node:fs");
const common_1 = require("@nestjs/common");
const serialport_1 = require("serialport");
const tl3800_config_service_1 = require("../../config/tl3800-config.service");
const tl_transport_interface_1 = require("./tl-transport.interface");
let SerialPortTransport = SerialPortTransport_1 = class SerialPortTransport {
    config;
    logger = new common_1.Logger(SerialPortTransport_1.name);
    port = null;
    openPath = null;
    buffer = Buffer.alloc(0);
    waiters = [];
    closing = false;
    constructor(config) {
        this.config = config;
    }
    async onModuleDestroy() {
        await this.close();
    }
    isOpen() {
        return this.port?.isOpen === true;
    }
    currentPath() {
        return this.isOpen() ? this.openPath : null;
    }
    async open(pathOverride, params) {
        if (this.isOpen()) {
            this.logger.debug(`Port already open: ${this.port.path}`);
            return;
        }
        const path = pathOverride ?? (await this.resolvePort(this.config.port));
        const baudRate = params?.baudRate ?? this.config.baudRate;
        const dataBits = (params?.dataBits ?? this.config.dataBits);
        const stopBits = (params?.stopBits ?? this.config.stopBits);
        const parity = params?.parity ?? this.config.parity;
        this.logger.log(`OPEN ${path} — ${baudRate}bps ${dataBits}${this.parityChar(parity)}${stopBits}`);
        const port = new serialport_1.SerialPort({
            path,
            baudRate,
            dataBits,
            stopBits,
            parity,
            rtscts: false,
            xon: false,
            xoff: false,
            autoOpen: false,
        });
        await new Promise((resolve, reject) => {
            port.open((err) => (err ? reject(err) : resolve()));
        });
        port.set({ dtr: true, rts: true }, () => undefined);
        port.on('data', (chunk) => this.onData(chunk));
        port.on('error', (err) => this.logger.error(`Serial error: ${err.message}`));
        port.on('close', () => {
            this.logger.log(`CLOSE ${path}`);
        });
        this.port = port;
        this.openPath = path;
        this.buffer = Buffer.alloc(0);
        await this.drainInputBuffer(250);
    }
    async close() {
        if (!this.port)
            return;
        this.closing = true;
        try {
            if (this.port.isOpen) {
                await new Promise((resolve) => {
                    this.port.close(() => resolve());
                });
            }
        }
        finally {
            this.port = null;
            this.openPath = null;
            this.buffer = Buffer.alloc(0);
            this.flushWaiters();
            this.closing = false;
        }
    }
    async write(bytes) {
        if (!bytes || bytes.length === 0)
            return;
        this.ensureOpen();
        await new Promise((resolve, reject) => {
            this.port.write(bytes, (err) => (err ? reject(err) : resolve()));
        });
        await new Promise((resolve, reject) => {
            this.port.drain((err) => (err ? reject(err) : resolve()));
        });
    }
    async readByte(timeoutMs) {
        this.ensureOpen();
        try {
            const buf = await this.readFully(1, timeoutMs);
            return buf[0];
        }
        catch (err) {
            if (err instanceof tl_transport_interface_1.TransportTimeoutError)
                return -1;
            throw err;
        }
    }
    async readFully(len, timeoutMs) {
        if (len <= 0)
            throw new RangeError('len must be positive');
        this.ensureOpen();
        if (this.buffer.length >= len)
            return this.takeFromBuffer(len);
        const deadline = Date.now() + timeoutMs;
        while (this.buffer.length < len) {
            const remaining = deadline - Date.now();
            if (remaining <= 0) {
                throw new tl_transport_interface_1.TransportTimeoutError(`readFully timeout: got ${this.buffer.length}/${len} bytes`);
            }
            await this.waitForData(remaining);
        }
        return this.takeFromBuffer(len);
    }
    async drainInputBuffer(windowMs) {
        if (!this.isOpen())
            return;
        const deadline = Date.now() + windowMs;
        let totalDrained = 0;
        while (Date.now() < deadline) {
            if (this.buffer.length > 0) {
                totalDrained += this.buffer.length;
                this.buffer = Buffer.alloc(0);
            }
            const remaining = deadline - Date.now();
            if (remaining <= 0)
                break;
            try {
                await this.waitForData(Math.min(50, remaining));
            }
            catch {
                break;
            }
            if (this.buffer.length > 0) {
                totalDrained += this.buffer.length;
                this.buffer = Buffer.alloc(0);
            }
            else {
                break;
            }
        }
        if (totalDrained > 0) {
            this.logger.debug(`Drained ${totalDrained} bytes from input buffer`);
        }
    }
    ensureOpen() {
        if (!this.isOpen())
            throw new Error('Serial port is not open');
    }
    onData(chunk) {
        this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
        this.flushWaiters();
    }
    takeFromBuffer(len) {
        const out = Buffer.from(this.buffer.subarray(0, len));
        this.buffer = this.buffer.subarray(len);
        return out;
    }
    waitForData(timeoutMs) {
        return new Promise((resolve, reject) => {
            let settled = false;
            const onData = () => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                resolve();
            };
            const timer = setTimeout(() => {
                if (settled)
                    return;
                settled = true;
                const idx = this.waiters.indexOf(onData);
                if (idx >= 0)
                    this.waiters.splice(idx, 1);
                if (this.closing) {
                    reject(new Error('Transport closed while reading'));
                }
                else {
                    reject(new tl_transport_interface_1.TransportTimeoutError(`Read timeout (${timeoutMs}ms)`));
                }
            }, timeoutMs);
            this.waiters.push(onData);
        });
    }
    flushWaiters() {
        while (this.waiters.length > 0) {
            const waiter = this.waiters.shift();
            waiter();
        }
    }
    async resolvePort(configured) {
        const raw = (configured ?? '').trim();
        if (!raw || raw.toLowerCase() === 'auto') {
            return this.detectPort();
        }
        if (!raw.includes('*') && !raw.includes('?')) {
            return raw;
        }
        const regex = globToRegex(raw);
        const list = await serialport_1.SerialPort.list();
        const match = list.find((p) => regex.test(p.path));
        if (match) {
            this.logger.log(`Port glob "${raw}" → ${match.path}`);
            return match.path;
        }
        throw new Error(`TL3800_PORT pattern "${raw}" did not match any enumerated serial port. ` +
            `Candidates: ${list.map((p) => p.path).join(', ') || '(none)'}`);
    }
    async listCandidatePorts() {
        const raw = (this.config.port ?? '').trim();
        if (raw && raw.toLowerCase() !== 'auto') {
            return [await this.resolvePort(raw)];
        }
        const list = await serialport_1.SerialPort.list();
        const ranked = rankCandidates(list);
        if (ranked.length > 0)
            return ranked.map((c) => c.path);
        try {
            return [await this.detectPort()];
        }
        catch {
            return [];
        }
    }
    async detectPort() {
        const list = await serialport_1.SerialPort.list();
        this.logEnumeratedPorts(list);
        const ranked = rankCandidates(list);
        if (ranked.length > 0) {
            this.logger.log(`Auto-detected ${ranked.length} candidate port(s): ${ranked
                .map((c) => `${c.path}(${c.score})`)
                .join(', ')}`);
            if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
                this.logger.warn(`⚠ Ambiguous auto-detect: ${ranked
                    .filter((c) => c.score === ranked[0].score)
                    .map((c) => c.path)
                    .join(' / ')} tie at score ${ranked[0].score}. ` +
                    `Picking "${ranked[0].path}" by enumeration order — this may be the WRONG port. ` +
                    `Let the gateway probe (leave TL3800_PORT blank) or pin TL3800_PORT explicitly.`);
            }
            return ranked[0].path;
        }
        if (process.platform === 'darwin' || process.platform === 'linux') {
            const dev = '/dev';
            if ((0, node_fs_1.existsSync)(dev)) {
                const entries = (0, node_fs_1.readdirSync)(dev);
                const scanned = entries.filter((n) => DEV_NAME_RE.test(n));
                scanned.sort((a, b) => scoreDevName(b) - scoreDevName(a));
                if (scanned[0]) {
                    const picked = `${dev}/${scanned[0]}`;
                    this.logger.log(`Auto-detected via /dev scan: ${picked} ` +
                        `(from ${scanned.slice(0, 5).join(', ')}${scanned.length > 5 ? ', …' : ''})`);
                    return picked;
                }
            }
        }
        throw new Error(`TL3800 USB serial port not found. Plug in the adapter, or set ` +
            `TL3800_PORT explicitly (supports globs, e.g. /dev/cu.usbserial-* or COM*). ` +
            `Enumerated ports: ${list.map((p) => p.path).join(', ') || '(none)'}`);
    }
    parityChar(p) {
        return { none: 'N', even: 'E', odd: 'O', mark: 'M', space: 'S' }[p];
    }
    logEnumeratedPorts(list) {
        if (list.length === 0) {
            this.logger.warn('No serial ports enumerated by the OS at all.');
            return;
        }
        const lines = list.map((p) => {
            const vidpid = p.vendorId || p.productId
                ? `${(p.vendorId ?? '????').toUpperCase()}:${(p.productId ?? '????').toUpperCase()}`
                : '—';
            const bits = [
                `VID:PID=${vidpid}`,
                p.manufacturer ? `mfr="${p.manufacturer}"` : '',
                p.friendlyName ? `name="${p.friendlyName}"` : '',
                p.serialNumber ? `sn=${p.serialNumber}` : '',
                `score=${scorePort(p)}`,
            ].filter(Boolean);
            return `  • ${p.path}  ${bits.join('  ')}`;
        });
        this.logger.log(`Enumerated ${list.length} serial port(s):\n${lines.join('\n')}`);
    }
};
exports.SerialPortTransport = SerialPortTransport;
exports.SerialPortTransport = SerialPortTransport = SerialPortTransport_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tl3800_config_service_1.TL3800ConfigService])
], SerialPortTransport);
const VENDOR_RE = /pl2303|prolific|cp210|silicon ?labs|slab|ftdi|ft232|ch340|ch341|wch|qinheng|hl-?340|mcp2221|usb ?serial|usb-?uart/i;
const VENDOR_IDS = new Set([
    '067b',
    '10c4',
    '0403',
    '1a86',
    '04d8',
].map((v) => v.toLowerCase()));
const DEV_NAME_RE = /^(cu\.(usbserial|usbmodem|PL2303|SLAB_USBtoUART|wchusbserial)|tty\.usbserial|ttyUSB\d+|ttyACM\d+)/;
const DARWIN_BUILTIN_RE = /Bluetooth-Incoming-Port|Bluetooth-PDA-Sync|debug-console|wlan-debug/i;
function rankCandidates(list) {
    const byKey = new Map();
    for (const p of list) {
        if (!p.path)
            continue;
        if (process.platform === 'darwin' && DARWIN_BUILTIN_RE.test(p.path))
            continue;
        const key = p.path.replace(/\/dev\/tty\./, '/dev/cu.');
        const existing = byKey.get(key);
        if (!existing) {
            byKey.set(key, { ...p, path: key });
        }
        else {
            if (!existing.manufacturer && p.manufacturer)
                existing.manufacturer = p.manufacturer;
            if (!existing.pnpId && p.pnpId)
                existing.pnpId = p.pnpId;
            if (!existing.vendorId && p.vendorId)
                existing.vendorId = p.vendorId;
            if (!existing.productId && p.productId)
                existing.productId = p.productId;
        }
    }
    const scored = [...byKey.values()]
        .map((p) => ({ path: p.path, score: scorePort(p) }))
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score);
    return scored;
}
function scorePort(p) {
    let score = 0;
    const hay = `${p.manufacturer ?? ''} ${p.pnpId ?? ''} ${p.path ?? ''}`;
    if (VENDOR_RE.test(hay))
        score += 10;
    const vid = (p.vendorId ?? '').toLowerCase().replace(/^0x/, '');
    if (vid && VENDOR_IDS.has(vid))
        score += 10;
    if (/usbserial|usbmodem|wchusbserial|ttyUSB|ttyACM/i.test(p.path))
        score += 5;
    if (process.platform === 'darwin' && p.path.startsWith('/dev/cu.'))
        score += 2;
    if (process.platform === 'win32' && /^COM\d+$/i.test(p.path))
        score += 1;
    return score;
}
function scoreDevName(name) {
    let s = 0;
    if (name.startsWith('cu.'))
        s += 5;
    if (/usbserial|wchusbserial|PL2303|SLAB_USBtoUART/.test(name))
        s += 3;
    if (/^ttyUSB\d+$/.test(name))
        s += 2;
    if (/^ttyACM\d+$/.test(name))
        s += 1;
    return s;
}
function globToRegex(glob) {
    const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const pattern = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${pattern}$`, 'i');
}
//# sourceMappingURL=serial-port.transport.js.map