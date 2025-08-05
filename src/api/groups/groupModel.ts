import { z } from "zod";

export const groupsUpdateReqBody = z.object({
  body: z.object({
    group_id: z.string(),
    message: z.string(),
    delay: z.number(),
    status: z.string(),
  }),
});

export const groupsReqBody = z.object({
  body: z.object({
    group_id: z.string(),
    message: z.string(),
    delay: z.number(),
    status: z.string(),
  }),
});

export const modelRes = z.object({
  status: z.boolean(),
});

export const groupsQuery = z.object({
  query: z.object({
    group_id: z.string(),
  }),
});

export const modelGetRes = z.object({
  message: z.string(),
  delay: z.number(),
  status: z.string(),
});
