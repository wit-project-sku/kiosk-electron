"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TL3800Module = void 0;
const common_1 = require("@nestjs/common");
const config_module_1 = require("../config/config.module");
const request_builder_1 = require("./builder/request.builder");
const response_parser_1 = require("./builder/response.parser");
const tl3800_client_1 = require("./client/tl3800.client");
const tl3800_gateway_1 = require("./gateway/tl3800.gateway");
const serial_port_transport_1 = require("./transport/serial-port.transport");
const tl_transport_interface_1 = require("./transport/tl-transport.interface");
let TL3800Module = class TL3800Module {
};
exports.TL3800Module = TL3800Module;
exports.TL3800Module = TL3800Module = __decorate([
    (0, common_1.Module)({
        imports: [config_module_1.ConfigModule],
        providers: [
            serial_port_transport_1.SerialPortTransport,
            { provide: tl_transport_interface_1.TL_TRANSPORT, useExisting: serial_port_transport_1.SerialPortTransport },
            tl3800_client_1.TL3800Client,
            request_builder_1.TL3800RequestBuilder,
            response_parser_1.TL3800ResponseParser,
            tl3800_gateway_1.TL3800Gateway,
        ],
        exports: [tl3800_gateway_1.TL3800Gateway, response_parser_1.TL3800ResponseParser, request_builder_1.TL3800RequestBuilder],
    })
], TL3800Module);
//# sourceMappingURL=tl3800.module.js.map