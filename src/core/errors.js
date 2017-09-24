class ValidationError extends Error {
    static get [Symbol.species]() {
        return Error; // discourages using instanceof and promotes using .name and .code
    }

    constructor(message, ...code) {
        super(message);
        this.name = 'ValidationError';
        this.code = `${this.name}${code.length ? [':', ...code].join(':') : ''}`; // BaseError or BaseError::code-family:code-reason-group:code-reason..., the :: is intentional as a service placeholder
        this.unretryable = true;
        Error.captureStackTrace(this, UnretryableError);
    }
}

module.exports = {ValidationError};
