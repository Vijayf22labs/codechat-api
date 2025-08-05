import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ZodError } from "zod";
import { CustomException } from "../exception";
import { ServiceResponse } from "../models/serviceResponse";

export function exceptionHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error("❗ Express Error:", err.stack);
  console.error("Error caught in global handler:", err);

  // Handle CustomException
  if (err instanceof CustomException) {
    return res.status(err.statusCode).json(ServiceResponse.failure(err.message, err.payload, err.statusCode));
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const errorMessage = err.errors.map((e) => e.message).join(", ");
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json(ServiceResponse.failure(errorMessage, null, StatusCodes.BAD_REQUEST));
  }

  // Handle other known error types
  if (err instanceof Error) {
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json(ServiceResponse.failure(err.message, null, StatusCodes.INTERNAL_SERVER_ERROR));
  }

  // Handle unknown errors
  return res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json(ServiceResponse.failure("An unexpected error occurred", null, StatusCodes.INTERNAL_SERVER_ERROR));
}
