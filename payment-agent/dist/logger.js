"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
const nest_winston_1 = require("nest-winston");
const winston = __importStar(require("winston"));
function createLogger() {
    const isProd = process.env.NODE_ENV === 'production';
    const level = process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug');
    const format = isProd
        ? winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json())
        : winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), winston.format.errors({ stack: true }), winston.format.colorize({ all: true }), winston.format.printf(({ timestamp, level: lvl, context, message, stack }) => `${timestamp} ${lvl} ${context ? `[${context}] ` : ''}${stack ?? message}`));
    return nest_winston_1.WinstonModule.createLogger({
        level,
        format,
        transports: [new winston.transports.Console({ handleExceptions: true })],
    });
}
//# sourceMappingURL=logger.js.map