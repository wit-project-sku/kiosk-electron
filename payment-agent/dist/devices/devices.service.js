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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevicesService = void 0;
const common_1 = require("@nestjs/common");
const central_payment_client_1 = require("../central/central-payment.client");
const tl3800_gateway_1 = require("../tl3800/gateway/tl3800.gateway");
const proto_util_1 = require("../tl3800/proto/proto.util");
let DevicesService = class DevicesService {
    gateway;
    central;
    constructor(gateway, central) {
        this.gateway = gateway;
        this.central = central;
    }
    async checkDevice() {
        const packet = await this.gateway.checkDevice();
        this.central.notifyMessage('[TL3800] 단말기 상태 확인 성공');
        return toDto(packet, '단말기 정상 응답');
    }
    async rebootDevice() {
        const packet = await this.gateway.rebootDevice();
        this.central.notifyMessage('[TL3800] 단말기 재부팅 명령 전송 성공');
        return toDto(packet, '재부팅 명령 전송 완료');
    }
};
exports.DevicesService = DevicesService;
exports.DevicesService = DevicesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tl3800_gateway_1.TL3800Gateway,
        central_payment_client_1.CentralPaymentClient])
], DevicesService);
function toDto(packet, message) {
    return {
        jobCode: packet.jobCode,
        responseCode: packet.responseCode,
        message: `${message}${packet.data.length ? ` — ${(0, proto_util_1.asciiTrim)(packet.data)}` : ''}`,
    };
}
//# sourceMappingURL=devices.service.js.map