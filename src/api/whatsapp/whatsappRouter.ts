import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import type { IuserProfile, LoginQRVerifyResponse, MulterRequest } from "@/api/whatsapp/whatsappInterface";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { StatusCodes } from "http-status-codes";
import fs from "fs";
import path from "path";

import {
  connectInstanceResponse,
  deliverMessageReqBody,
  getScheduleMessageQuery,
  getUuidReqParams,
  initRequestBody,
  initStatusResponse,
  invitationReqBody,
  invitationResponse,
  loginRequestParams,
  messageReqParams,
  scheduleMessageReqBody,
  scheduleMessageResponse,
  webhookReqBody,
  webhookResponse,
} from "@/api/whatsapp/whatsappModel";
import { whatsappServiceInstance as whatsappService } from "@/api/whatsapp/whatsappService";
import { verifyInstance, verifyUserInstance, verifyWhatsappInstance } from "@/common/middleware/checkingInstance";
import { handleServiceResponse, validateRequest } from "@/common/utils/httpHandlers";
import { notifySlack } from "@/common/utils/slack";
import { logger } from "@/server";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Request, type Response, type Router, NextFunction } from "express";
import multer from "multer";
import { allowSourceFrom } from "@/common/middleware/allowSourceFrom";
import { CustomException } from "@/common/exception";

const upload = multer();
export const whatsappRegistry = new OpenAPIRegistry();
export const whatsappRouter: Router = express.Router();

whatsappRegistry.registerPath({
  method: "post",
  path: "/whatsapp/init",
  tags: ["Whatsapp"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: initRequestBody,
        },
      },
    },
  },
  responses: createApiResponse(connectInstanceResponse, "Success"),
});

whatsappRouter.post("/init", validateRequest(initRequestBody), async (req: Request, res: Response) => {
  const { instanceName, description } = req.body;
  const serviceResponse = await whatsappService.init(instanceName, description);
  return handleServiceResponse(serviceResponse, res);
});

whatsappRegistry.registerPath({
  method: "get",
  path: "/whatsapp/init/status/{uuid}",
  tags: ["Whatsapp"],
  request: { params: getUuidReqParams.shape.params },
  responses: createApiResponse(initStatusResponse, "Success"),
});

whatsappRouter.get("/init/status/:uuid", validateRequest(getUuidReqParams), async (req: Request, res: Response) => {
  const { uuid } = req.params;
  const serviceResponse = await whatsappService.instanceStatus(uuid);
  return handleServiceResponse(serviceResponse, res);
});

whatsappRouter.get("/user/status", async (req: Request, res: Response) => {
  const { id } = req.headers;
  const serviceResponse = await whatsappService.userStatus(id as string);
  return handleServiceResponse(serviceResponse, res);
});

whatsappRegistry.registerPath({
  method: "post",
  path: "/whatsapp/schedule",
  tags: ["Whatsapp"],
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: scheduleMessageReqBody,
        },
      },
    },
  },
  responses: createApiResponse(scheduleMessageResponse, "Success"),
});

whatsappRouter.post(
  "/schedule",
  upload.single("media"),
  validateRequest(scheduleMessageReqBody),
  verifyInstance,
  async (req: Request, res: Response) => {
    const { id } = req.headers;
    const mobile_number = req.body.user.mobile_number;
    req.body.sender = mobile_number;
    req.body.file = (req as unknown as MulterRequest).file;
    const serviceResponse = await whatsappService.createScheduleMessage({
      id,
      ...req.body,
      message_type: "Schedule",
    });
    return handleServiceResponse(serviceResponse, res);
  },
);

whatsappRegistry.registerPath({
  method: "put",
  path: "/whatsapp/schedule/{id}",
  tags: ["Whatsapp"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: messageReqParams,
        },
      },
    },
  },
  responses: createApiResponse(scheduleMessageResponse, "Success"),
});

whatsappRouter.put(
  "/schedule/:id",
  upload.single("media"),
  validateRequest(messageReqParams),
  verifyInstance,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    if (req.body.media_type) req.body.file = (req as unknown as MulterRequest).file;
    const updateData = req.body;
    const serviceResponse = await whatsappService.updateSchedule(id, updateData);
    return handleServiceResponse(serviceResponse, res);
  },
);

whatsappRegistry.registerPath({
  method: "post",
  path: "/whatsapp/deliver",
  tags: ["Whatsapp"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: messageReqParams,
        },
      },
    },
  },
  responses: createApiResponse(scheduleMessageResponse, "Success"),
});

whatsappRouter.post(
  "/deliver",
  validateRequest(deliverMessageReqBody),
  verifyInstance,
  async (req: Request, res: Response) => {
    const { message_id } = req.body;
    const { id } = req.headers;
    const serviceResponse = await whatsappService.handleDeliverMessage(id as string, message_id);
    return handleServiceResponse(serviceResponse, res);
  },
);

whatsappRegistry.registerPath({
  method: "get",
  path: "/whatsapp/schedules",
  tags: ["Whatsapp"],
  request: { query: getScheduleMessageQuery.shape.query },
  responses: createApiResponse(scheduleMessageResponse, "Success"),
});

whatsappRouter.get(
  "/schedules",
  validateRequest(getScheduleMessageQuery),
  verifyWhatsappInstance,
  verifyUserInstance,
  async (req: Request, res: Response) => {
    const status = req.query.status as string;
    const receiver = req.query.receiver ? (req.query.receiver as string).split("@c.us")[0] : "";
    const page = req.query.page as string;
    const limit = req.query.limit as string;
    const pageNo = Number.parseInt(page) || 1;
    const pageSize = Number.parseInt(limit) || 30;
    const skip = (pageNo - 1) * pageSize;
    const sender = req.body.user.mobile_number;
    const serviceResponse = await whatsappService.getScheduleMessage({
      status,
      sender,
      pageSize,
      skip,
      pageNo,
      receiver,
    });
    return handleServiceResponse(serviceResponse, res);
  },
);

whatsappRegistry.registerPath({
  method: "delete",
  path: "/whatsapp/schedule/{id}",
  tags: ["Whatsapp"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: messageReqParams,
        },
      },
    },
  },
  responses: createApiResponse(scheduleMessageResponse, "Success"),
});

whatsappRouter.delete(
  "/schedule/:id",
  validateRequest(messageReqParams),
  verifyInstance,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    logger.info("delete schedule Router called");
    const serviceResponse = await whatsappService.deleteSchedule(id);
    return handleServiceResponse(serviceResponse, res);
  },
);

whatsappRegistry.registerPath({
  method: "post",
  path: "/whatsapp/webhook",
  tags: ["Whatsapp"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: webhookReqBody,
        },
      },
    },
  },
  responses: createApiResponse(webhookResponse, "Success"),
});

whatsappRouter.post("/webhook", async (req: Request, res: Response) => {
  const { event, instance, data } = req.body;
  logger.info(`New Event received: ${event}`);
  switch (event) {
    case "connection.update":
      await whatsappService.handleConnectionUpdate(instance, data);
      break;
    case "group-participants.update":
      await whatsappService.handleGroupParticipantsUpdate(instance, data);
      break;
    case "status.instance":
      await whatsappService.handleInstanceRemoval(instance, data);
      break;
    case "send.message":
      await whatsappService.handleMessageDelivery(instance, data);
      break;
    case "refreshToken":
      await whatsappService.handleRefreshToken(instance, data);
      break;
    default:
      return ServiceResponse.failure("Invalid event", null, StatusCodes.BAD_REQUEST);
  }
  return ServiceResponse.success<any | null>("Webhook Processed!!", {});
});

whatsappRouter.post("/removeUnusedInstances", async (req: Request, res: Response) => {
  const { id } = req.headers;
  if (id === process.env.APIKEY) {
    await whatsappService.removeUnusedInstances();
    return ServiceResponse.success<any | null>("Instances Removed!!", {});
  } else {
    return ServiceResponse.failure("Unauthorized", null, StatusCodes.INTERNAL_SERVER_ERROR);
  }
});

whatsappRegistry.registerPath({
  method: "post",
  path: "/whatsapp/invitation",
  tags: ["Whatsapp"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: invitationReqBody,
        },
      },
    },
  },
  responses: createApiResponse(invitationResponse, "Success"),
});

whatsappRouter.post("/invitation", validateRequest(invitationReqBody), async (req: Request, res: Response) => {
  const { referee, referral, status } = req.body;
  const serviceResponse = await whatsappService.createInvitation(referee, referral, status);
  return handleServiceResponse(serviceResponse, res);
});

whatsappRouter.get("/login", async (req: Request, res: Response) => {
  const { id } = req.headers;
  if (!id) return ServiceResponse.failure("Instance name missing", null, StatusCodes.NOT_FOUND);
  const serviceResponse = await whatsappService.generateMobileQR(id as string);
  return handleServiceResponse(serviceResponse, res);
});

whatsappRouter.post("/login/verify", async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) return ServiceResponse.failure("Invalid token", null, StatusCodes.NOT_FOUND);
  const serviceResponse = await whatsappService.verifyLogin(token);
  return handleServiceResponse(serviceResponse, res);
});

whatsappRouter.post("/otp/verify", allowSourceFrom(['pwa'], ['ios']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mobile_number, otp } = req.body;
    const response = await whatsappService.verifyOtp(mobile_number, otp);
    return handleServiceResponse(ServiceResponse.success<LoginQRVerifyResponse | null>("Login Successful", response), res);
  } catch (err) {
    next(err);
  }
});

whatsappRouter.get("/profile", verifyUserInstance, allowSourceFrom(['web']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mobile_number, otp } = req.body.user
    return handleServiceResponse(ServiceResponse.success<IuserProfile | null>("", { mobile_number, otp }), res);
  } catch (err) {
    next(err);
  }
});
