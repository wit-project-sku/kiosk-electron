"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TL_TRANSPORT = exports.UserCancelledError = exports.TransportTimeoutError = void 0;
class TransportTimeoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TransportTimeoutError';
    }
}
exports.TransportTimeoutError = TransportTimeoutError;
class UserCancelledError extends Error {
    constructor(message = 'Payment cancelled by user') {
        super(message);
        this.name = 'UserCancelledError';
    }
}
exports.UserCancelledError = UserCancelledError;
exports.TL_TRANSPORT = Symbol('TL_TRANSPORT');
//# sourceMappingURL=tl-transport.interface.js.map