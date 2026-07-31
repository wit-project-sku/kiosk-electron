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
var OutboxWorker_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxWorker = void 0;
const axios_1 = require("@nestjs/axios");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
const outbox_service_1 = require("./outbox.service");
let OutboxWorker = OutboxWorker_1 = class OutboxWorker {
    outbox;
    http;
    config;
    logger = new common_1.Logger(OutboxWorker_1.name);
    intervalMs;
    timer = null;
    running = false;
    stopping = false;
    constructor(outbox, http, config) {
        this.outbox = outbox;
        this.http = http;
        this.config = config;
        this.intervalMs = this.config.getOrThrow('OUTBOX_WORKER_INTERVAL_MS');
    }
    onModuleInit() {
        this.logger.log(`outbox worker starting (interval=${this.intervalMs}ms)`);
        this.timer = setInterval(() => void this.tick(), this.intervalMs);
        void this.tick();
    }
    async onModuleDestroy() {
        this.stopping = true;
        if (this.timer)
            clearInterval(this.timer);
        const deadline = Date.now() + 5_000;
        while (this.running && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 50));
        }
    }
    async tick() {
        if (this.running || this.stopping)
            return;
        this.running = true;
        try {
            const jobs = this.outbox.takeDue(25);
            if (jobs.length === 0)
                return;
            for (const job of jobs) {
                if (this.stopping)
                    return;
                await this.process(job);
            }
        }
        catch (err) {
            this.logger.error(`outbox tick error: ${err.message}`);
        }
        finally {
            this.running = false;
        }
    }
    async process(job) {
        try {
            await (0, rxjs_1.firstValueFrom)(this.http.post(job.uri, JSON.parse(job.body)));
            this.outbox.markSuccess(job.id);
            this.logger.log(`outbox → delivered id=${job.id} ${job.type} ${job.dedupe_key} (attempts=${job.attempts + 1})`);
        }
        catch (err) {
            const msg = err.message;
            const nextBackoff = Math.min(30_000 * (job.attempts + 1), 600_000);
            this.outbox.markFailure(job.id, msg, nextBackoff);
            if (job.attempts + 1 >= job.max_attempts) {
                this.logger.error(`outbox ✗ DEAD-LETTER id=${job.id} ${job.type} ${job.dedupe_key} after ${job.attempts + 1} attempts: ${msg}`);
            }
            else {
                this.logger.warn(`outbox ✗ retry later id=${job.id} attempts=${job.attempts + 1}/${job.max_attempts} backoff=${nextBackoff}ms: ${msg}`);
            }
        }
    }
};
exports.OutboxWorker = OutboxWorker;
exports.OutboxWorker = OutboxWorker = OutboxWorker_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [outbox_service_1.OutboxService,
        axios_1.HttpService,
        config_1.ConfigService])
], OutboxWorker);
//# sourceMappingURL=outbox.worker.js.map