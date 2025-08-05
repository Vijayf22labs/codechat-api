import { z } from "zod";
export type IcommonMemberRes = z.infer<typeof commonMemberRes>;
export const tagsReqBody = z.object({
  body: z.object({
    tags: z.array(z.string()),
    user_name: z.string(),
    mobile_number: z.string(),
    addedAt: z.union([z.date(), z.number().transform((timestamp) => new Date(timestamp))]).optional(),
  }),
});

export const tagsRes = z.object({
  status: z.boolean(),
});

export const tagsQuery = z.object({
  query: z.object({
    mobile_number: z.string().optional(),
    tag: z.string().optional(),
  }),
});

export const commonMemberTagsQuery = z.object({
  query: z.object({
    tags: z.array(z.string(), { message: "Missing Tags" }),
  }),
});

const memberSchema = z.object({
  user_name: z.string(),
  mobile_number: z.string(),
  _id: z.string(),
  addedAt: z.union([z.date(), z.number().transform((timestamp) => new Date(timestamp)), z.null()]).optional(),
});

const tagObjectSchema = z.object({
  name: z.string(),
  members: z.array(memberSchema),
  memberCount: z.number(),
});

// Define the schema for an array of tag objects
export const tagsFilterRes = z.array(tagObjectSchema);

export const commonMemberRes = z.object({
  commonMembers: z.array(memberSchema),
});
