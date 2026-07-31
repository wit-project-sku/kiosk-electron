"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DonationsModule = void 0;
const common_1 = require("@nestjs/common");
const central_module_1 = require("../central/central.module");
const tl3800_module_1 = require("../tl3800/tl3800.module");
const donations_controller_1 = require("./donations.controller");
const donations_service_1 = require("./donations.service");
let DonationsModule = class DonationsModule {
};
exports.DonationsModule = DonationsModule;
exports.DonationsModule = DonationsModule = __decorate([
    (0, common_1.Module)({
        imports: [tl3800_module_1.TL3800Module, central_module_1.CentralModule],
        controllers: [donations_controller_1.DonationsController],
        providers: [donations_service_1.DonationsService],
    })
], DonationsModule);
//# sourceMappingURL=donations.module.js.map