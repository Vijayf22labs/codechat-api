import { StatusCodes } from 'http-status-codes';

export class CustomException extends Error {
  public readonly statusCode: number;
  public readonly payload?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR,
    payload?: Record<string, any>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.payload = payload;

    Error.captureStackTrace(this, this.constructor);

    Object.setPrototypeOf(this, CustomException.prototype);
  }
}

export class NotFoundException extends CustomException {
  constructor(message: string = 'Resource not found', payload?: Record<string, any>) {
    super(message, StatusCodes.NOT_FOUND, payload);
  }
}

export class UnauthorizedException extends CustomException {
  constructor(message: string = 'Unauthorized access', payload?: Record<string, any>) {
    super(message, StatusCodes.UNAUTHORIZED, payload);
  }
}

export class BadRequestException extends CustomException {
  constructor(message: string = 'Bad request', payload?: Record<string, any>) {
    super(message, StatusCodes.BAD_REQUEST, payload);
  }
}

export class ForbiddenException extends CustomException {
  constructor(message: string = 'Forbidden access', payload?: Record<string, any>) {
    super(message, StatusCodes.FORBIDDEN, payload);
  }
}
