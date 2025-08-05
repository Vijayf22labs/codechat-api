import { openAPIRouter } from "@/api-docs/openAPIRouter";
import { groupsRouter } from "@/api/groups/groupRouter";
import { healthCheckRouter } from "@/api/healthCheck/healthCheckRouter";
import { tagsRouter } from "@/api/tags/tagRouter";
import { whatsappRouter } from "@/api/whatsapp/whatsappRouter";
import errorHandler from "@/common/middleware/errorHandler";
import rateLimiter from "@/common/middleware/rateLimiter";
import requestLogger from "@/common/middleware/requestLogger";
import { startCronJobs } from "@/common/utils/cronJobs";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pino } from "pino";
import { requestLoggerHelper } from "./common/middleware/requestLoggerHelper";
import "./api/whatsapp/events/eventListener";
import { exceptionHandler } from "./common/middleware/exceptionHandler";

const logger = pino({ name: "server start" });
const app: Express = express();

startCronJobs();

// Set the application to trust the reverse proxy
app.set("trust proxy", true);

// Middlewares
app.use(cors());
app.use(helmet());
app.use(rateLimiter);
app.use(express.json());

// Request logging
// app.use(requestLogger);

// Routes
app.use("/health-check", healthCheckRouter);

app.use("/whatsapp", requestLoggerHelper, whatsappRouter);
app.use("/tags", requestLoggerHelper, tagsRouter);
app.use("/groups", requestLoggerHelper, groupsRouter);

// Swagger UI
app.use(openAPIRouter);

// Error handlers - order matters!
app.use(exceptionHandler);
app.use(errorHandler());

export { app, logger };
