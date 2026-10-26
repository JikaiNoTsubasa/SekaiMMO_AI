"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.HttpError = void 0;
class HttpError extends Error {
    constructor(message, status = 500, details) {
        super(message);
        this.status = status;
        this.details = details;
        this.name = 'HttpError';
    }
}
exports.HttpError = HttpError;
const errorHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) {
        res.status(err.status).json({ message: err.message, details: err.details });
        return;
    }
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
};
exports.errorHandler = errorHandler;
