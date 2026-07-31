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
exports.DevicesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const base_response_dto_1 = require("../common/dto/base-response.dto");
const devices_service_1 = require("./devices.service");
let DevicesController = class DevicesController {
    service;
    constructor(service) {
        this.service = service;
    }
    async status() {
        const data = await this.service.checkDevice();
        return base_response_dto_1.BaseResponse.ok(data, '단말기 상태 확인 성공');
    }
    async reboot() {
        const data = await this.service.rebootDevice();
        return base_response_dto_1.BaseResponse.ok(data, '재부팅 명령 전송 성공');
    }
};
exports.DevicesController = DevicesController;
__decorate([
    (0, common_1.Get)('status'),
    (0, swagger_1.ApiOperation)({ summary: '단말기 상태 확인', description: 'TL-3800에 CheckDevice(JobCode A) 요청을 보냅니다.' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DevicesController.prototype, "status", null);
__decorate([
    (0, common_1.Post)('reboot'),
    (0, swagger_1.ApiOperation)({ summary: '단말기 재부팅', description: 'TL-3800에 Reboot(JobCode R) 요청을 보냅니다.' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DevicesController.prototype, "reboot", null);
exports.DevicesController = DevicesController = __decorate([
    (0, swagger_1.ApiTags)('단말기'),
    (0, common_1.Controller)('api/devices'),
    __metadata("design:paramtypes", [devices_service_1.DevicesService])
], DevicesController);
//# sourceMappingURL=devices.controller.js.map