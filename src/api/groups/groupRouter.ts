import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { groupServiceInstance } from "@/api/groups/groupService";
import { verifyUserInstance } from "@/common/middleware/checkingInstance";
import { handleServiceResponse, validateRequest } from "@/common/utils/httpHandlers";
import { logger } from "@/server";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Request, type Response, type Router } from "express";
import { groupsQuery, groupsReqBody, groupsUpdateReqBody, modelGetRes, modelRes } from "./groupModel";
export const groupsRegistry = new OpenAPIRegistry();
export const groupsRouter: Router = express.Router();

groupsRegistry.registerPath({
  method: "put",
  path: "/groups",
  tags: ["groups"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: groupsUpdateReqBody,
        },
      },
    },
  },
  responses: createApiResponse(modelRes, "Success"),
});

groupsRouter.put("/", validateRequest(groupsUpdateReqBody), verifyUserInstance, async (req: Request, res: Response) => {
  const { id } = req.headers;
  const instance_id = id as string;
  const serviceResponse = await groupServiceInstance.put(instance_id, req.body);
  return handleServiceResponse(serviceResponse, res);
});

groupsRegistry.registerPath({
  method: "get",
  path: "/groups",
  tags: ["groups"],
  request: { query: groupsQuery.shape.query },
  responses: createApiResponse(modelGetRes, "Success"),
});

groupsRouter.get("/", validateRequest(groupsQuery), verifyUserInstance, async (req: Request, res: Response) => {
  const { id } = req.headers;
  const instance_id = id as string;
  const group_id = req.query.group_id as string;
  const serviceResponse = await groupServiceInstance.get(group_id, instance_id);
  return handleServiceResponse(serviceResponse, res);
});

groupsRegistry.registerPath({
  method: "delete",
  path: "/groups",
  tags: ["groups"],
  request: { query: groupsQuery.shape.query },
  responses: createApiResponse(modelRes, "Success"),
});

groupsRouter.delete("/", validateRequest(groupsQuery), verifyUserInstance, async (req: Request, res: Response) => {
  const { id } = req.headers;
  const instance_id = id as string;
  const group_id = req.query.group_id as string;
  const serviceResponse = await groupServiceInstance.delete(group_id, instance_id);
  return handleServiceResponse(serviceResponse, res);
});

groupsRegistry.registerPath({
  method: "post",
  path: "/groups",
  tags: ["groups"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: groupsReqBody,
        },
      },
    },
  },
  responses: createApiResponse(modelRes, "Success"),
});

groupsRouter.post("/", validateRequest(groupsReqBody), verifyUserInstance, async (req: Request, res: Response) => {
  const { id } = req.headers;
  const instance_id = id as string;
  const { group_id, message, delay, status } = req.body;
  const serviceResponse = await groupServiceInstance.create(instance_id, { group_id, message, delay, status });
  return handleServiceResponse(serviceResponse, res);
});
