import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { tagsServiceInstance } from "@/api/tags/tagService";
import { verifyUserInstance } from "@/common/middleware/checkingInstance";
import { handleServiceResponse, validateRequest } from "@/common/utils/httpHandlers";
import { logger } from "@/server";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Request, type Response, type Router } from "express";
import { commonMemberRes, commonMemberTagsQuery, tagsFilterRes, tagsQuery, tagsReqBody, tagsRes } from "./tagModel";
export const tagsRegistry = new OpenAPIRegistry();
export const tagsRouter: Router = express.Router();

tagsRegistry.registerPath({
  method: "put",
  path: "/tags",
  tags: ["Tags"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: tagsReqBody,
        },
      },
    },
  },
  responses: createApiResponse(tagsRes, "Success"),
});

tagsRouter.put("/", validateRequest(tagsReqBody), verifyUserInstance, async (req: Request, res: Response) => {
  const { id } = req.headers;
  const instance_id = id as string;
  const { tags, user_name, mobile_number, addedAt } = req.body;
  const serviceResponse = await tagsServiceInstance.createOrUpdate(
    tags,
    user_name,
    mobile_number,
    instance_id,
    addedAt,
  );
  return handleServiceResponse(serviceResponse, res);
});

tagsRegistry.registerPath({
  method: "get",
  path: "/tags",
  tags: ["Tags"],
  request: { query: tagsQuery.shape.query },
  responses: createApiResponse(tagsFilterRes, "Success"),
});

tagsRouter.get("/", validateRequest(tagsQuery), verifyUserInstance, async (req: Request, res: Response) => {
  const { id } = req.headers;
  const instance_id = id as string;
  const tag = req.query.tag as string;
  const mobile_number = req.query.mobile_number as string;
  const serviceResponse = await tagsServiceInstance.get(tag, mobile_number, instance_id);
  return handleServiceResponse(serviceResponse, res);
});

tagsRegistry.registerPath({
  method: "delete",
  path: "/tags",
  tags: ["Tags"],
  request: { query: tagsQuery.shape.query },
  responses: createApiResponse(tagsFilterRes, "Success"),
});

tagsRouter.delete("/", validateRequest(tagsQuery), verifyUserInstance, async (req: Request, res: Response) => {
  const { id } = req.headers;
  const instance_id = id as string;
  const tag = req.query.tag as string;
  const mobile_number = req.query.mobile_number as string;
  const serviceResponse = await tagsServiceInstance.delete(tag, mobile_number, instance_id);
  return handleServiceResponse(serviceResponse, res);
});

tagsRegistry.registerPath({
  method: "get",
  path: "/tags/common_members",
  tags: ["Tags"],
  request: { query: commonMemberTagsQuery.shape.query },
  responses: createApiResponse(commonMemberRes, "Success"),
});

tagsRouter.get(
  "/common_members",
  validateRequest(commonMemberTagsQuery),
  verifyUserInstance,
  async (req: Request, res: Response) => {
    const tags = req.query.tags as string[];
    const serviceResponse = await tagsServiceInstance.getCommonMemberTags(tags, req.query.sender as string);
    return handleServiceResponse(serviceResponse, res);
  },
);
