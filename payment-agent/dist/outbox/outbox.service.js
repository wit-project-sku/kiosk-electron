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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var OutboxService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxService = exports.OutboxJobType = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
var OutboxJobType;
(function (OutboxJobType) {
    OutboxJobType["APPROVE"] = "APPROVE";
    OutboxJobType["CANCEL"] = "CANCEL";
    OutboxJobType["DONATION_APPROVE"] = "DONATION_APPROVE";
})(OutboxJobType || (exports.OutboxJobType = OutboxJobType = {}));
let OutboxService = OutboxService_1 = class OutboxService {
    config;
    logger = new common_1.Logger(OutboxService_1.name);
    db;
    maxAttempts;
    dbPath;
    constructor(config) {
        this.config = config;
        this.dbPath = this.config.getOrThrow('OUTBOX_DB_PATH');
        this.maxAttempts = this.config.getOrThrow('OUTBOX_MAX_ATTEMPTS');
    }
    onModuleInit() {
        try {
            (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(this.dbPath), { recursive: true });
        }
        catch {
        }
        this.db = new better_sqlite3_1.default(this.dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS outbox (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        type             TEXT    NOT NULL,
        uri              TEXT    NOT NULL,
        body             TEXT    NOT NULL,
        dedupe_key       TEXT    NOT NULL UNIQUE,
        attempts         INTEGER NOT NULL DEFAULT 0,
        max_attempts     INTEGER NOT NULL,
        next_attempt_at  INTEGER NOT NULL,
        last_error       TEXT,
        created_at       INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_outbox_due
        ON outbox(next_attempt_at)
        WHERE attempts < max_attempts;
    `);
        this.logger.log(`outbox ready at ${this.dbPath}`);
    }
    onModuleDestroy() {
        try {
            this.db?.close();
        }
        catch (err) {
            this.logger.warn(`outbox close error: ${err.message}`);
        }
    }
    enqueue(input) {
        const now = Date.now();
        try {
            this.db
                .prepare(`INSERT OR IGNORE INTO outbox
             (type, uri, body, dedupe_key, attempts, max_attempts, next_attempt_at, created_at)
           VALUES (?, ?, ?, ?, 0, ?, ?, ?)`)
                .run(input.type, input.uri, JSON.stringify(input.body), input.dedupeKey, this.maxAttempts, now, now);
            this.logger.log(`outbox ← ${input.type} ${input.dedupeKey}`);
        }
        catch (err) {
            this.logger.error(`FAILED to enqueue outbox job ${input.dedupeKey}: ${err.message}`);
        }
    }
    takeDue(limit, now = Date.now()) {
        return this.db
            .prepare(`SELECT * FROM outbox
         WHERE attempts < max_attempts AND next_attempt_at <= ?
         ORDER BY next_attempt_at ASC, id ASC
         LIMIT ?`)
            .all(now, limit);
    }
    markSuccess(id) {
        this.db.prepare(`DELETE FROM outbox WHERE id = ?`).run(id);
    }
    markFailure(id, err, backoffMs) {
        this.db
            .prepare(`UPDATE outbox
         SET attempts = attempts + 1,
             next_attempt_at = ?,
             last_error = ?
         WHERE id = ?`)
            .run(Date.now() + backoffMs, err.slice(0, 1000), id);
    }
    pendingCount() {
        const row = this.db
            .prepare(`SELECT COUNT(*) AS n FROM outbox WHERE attempts < max_attempts`)
            .get();
        return row.n;
    }
    deadLetterCount() {
        const row = this.db
            .prepare(`SELECT COUNT(*) AS n FROM outbox WHERE attempts >= max_attempts`)
            .get();
        return row.n;
    }
};
exports.OutboxService = OutboxService;
exports.OutboxService = OutboxService = OutboxService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OutboxService);
//# sourceMappingURL=outbox.service.js.map