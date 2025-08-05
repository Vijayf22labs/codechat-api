import type { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { log } from "../utils/logger";

export const requestLoggerHelper = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers["x-request-id"] ||  uuidv4();

  log(`${requestId} ${req.method} ${req.url}`);
  log(`${requestId} Query Params: ${JSON.stringify(req.query)}`);
  log(`${requestId} Body: ${JSON.stringify(req.body)}`);

  const originalSend = res.send;
  res.send = (...args: unknown[]): Response => {
    const [body] = args;
    log(`${requestId} Status: ${res.statusCode}`);
    log(`${requestId} Response: ${JSON.stringify(body)}`);
    return originalSend.apply(res, [body]);
  };

  next();
};
