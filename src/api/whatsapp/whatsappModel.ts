import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { query } from "express";
import { z } from "zod";
export type ConnectInstanceResponse = z.infer<typeof connectInstanceResponse>;
export type scheduleMessage = z.infer<typeof scheduleMessageReqBody>;
export type InstanceType = z.infer<typeof instancesResponse>;
extendZodWithOpenApi(z);
// Define the Zod schema for the request body
export const initRequestBody = z.object({
  body: z.object({
    instanceName: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const connectInstanceResponse = z.object({
  count: z.number(),
  base64: z.string(),
  code: z.string(),
  instanceName: z.string(),
});

export const mesageReqBody = z.object({
  instanceName: z.string({ message: "instanceName is Required" }),
  recepient: z.string({ message: "recepient is Required" }),
  message: z.string({ message: "message is Required" }),
  scheduled_at: z.date({ message: "scheduled_at is Required" }),
});

export const scheduleMessageReqBody = z.object({
  body: z.object({
    receiver_name: z.string({ message: "receiver_name is Required" }),
    message: z.string({ message: "message is Required" }).optional(),
    receiver: z.string({ message: "receiver is Required" }),
    scheduled_at: z.string({ message: "scheduled_at Required" }),
    // instanceName: z.string({ message: "instanceName is Required" }),
  }),
});

export const deliverMessageReqBody = z.object({
  body: z.object({
    message_id: z.string({ message: "Message id is Required" }),
  }),
});

export const scheduleMessageResponse = z.object({
  receiver_name: z.string({ message: "receiver_name is Required" }),
  message: z.string({ message: "message is Required" }),
  sender: z.string({ message: " sender is Required" }),
  receiver: z.string({ message: "receiver is Required" }),
  scheduled_at: z.string({ message: "scheduled_at is Required" }),
  retry_count: z.number({ message: "retry_count is Required" }),
  version: z.number({ message: "version is Required" }),
  status: z.string({ message: "status is Required" }),
  _id: z.string({ message: "_id is Required" }),
  createdAt: z.string({ message: "createdAt is Required" }),
  updatedAt: z.string({ message: "updatedAt is Required" }),
  // instanceName: z.string({ message: "instanceName is Required" }),
});

export const getScheduleMessageQuery = z.object({
  query: z.object({
    status: z.string({ message: "status is required" }),
    receiver: z.string().optional(),
  }),
});

export const messageReqParams = z.object({
  params: z.object({
    id: z.string({ message: "id is required" }),
  }),
});

export const loginRequestParams = z.object({
  params: z.object({
    id: z.string({ message: "id is required" }),
  }),
});

// Input Validation for 'GET init/:uuid' endpoint
export const getUuidReqParams = z.object({
  params: z.object({
    uuid: z.string({ message: "uuid is required" }),
  }),
});

// Input Validation for 'GET init/:uuid' endpoint
export const ScheduleReqQuery = z.object({
  query: z.object({
    status: z.string({ message: "status is required" }),
    page: z.string({ message: "page is required" }),
    limit: z.string({ message: "limit is required" }),
  }),
});

export const userReqParams = z.object({
  params: z.object({
    id: z.string({ message: "id is required" }),
  }),
});

export const invitationReqBody = z.object({
  body: z.object({
    referral: z.string({ message: "referral is required" }),
    referee: z.string({ message: "referee is required" }),
    status: z.string({ message: "status is required" }),
  }),
});

export const invitationResponse = z.object({
  referral: z.string({ message: "referral is required" }),
  referee: z.string({ message: "refereel is required" }),
  status: z.string({ message: "status is required" }),
});

export const instancesResponse = z.object({
  uuid: z.string(),
  id: z.string(),
  mobile_number: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const instancesReqBody = z.object({
  body: z.object({
    mobile_number: z.string(),
  }),
});

export const userReqBody = z.object({
  body: z.object({
    mobile_number: z.string({ message: "mobile_number is required" }),
    instance_id: z.string({ message: "instance_id is required" }),
    invite_code: z.string().optional(),
  }),
});

export const userResponse = z.object({
  mobile_number: z.string(),
  instance_id: z.string(),
  _id: z.string(),
  messages: z.array(scheduleMessageResponse),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const webhookReqBody = z.object({
  body: z.object({
    enabled: z.boolean({ message: "enable is required" }),
    url: z.string({ message: "url is required" }),
    events: z.object({
      qrcodeUpdated: z.boolean({ message: "enable is required" }),
      messagesSet: z.boolean({ message: "messagesSet is required" }),
      messagesUpsert: z.boolean({ message: "messagesUpsert is required" }),
      messagesUpdated: z.boolean({ message: "messagesUpdated is required" }),
      sendMessage: z.boolean({ message: "sendMessage is required" }),
      contactsSet: z.boolean({ message: "contactsSet is required" }),
      contactsUpsert: z.boolean({ message: "contactsUpsert is required" }),
      contactsUpdated: z.boolean({ message: "contactsUpdated is required" }),
      chatsSet: z.boolean({ message: "chatsSet is required" }),
      chatsUpsert: z.boolean({ message: "chatsUpsert is required" }),
      chatsUpdated: z.boolean({ message: "chatsUpdated is required" }),
      chatsDeleted: z.boolean({ message: "chatsDeleted is required" }),
      presenceUpdated: z.boolean({ message: "presenceUpdated is required" }),
      groupsUpsert: z.boolean({ message: "groupsUpsert is required" }),
      groupsUpdated: z.boolean({ message: "groupsUpdated is required" }),
      groupsParticipantsUpdated: z.boolean({ message: " groupsParticipantsUpdated is required" }),
      connectionUpdated: z.boolean({ message: "connectionUpdated is required" }),
      statusInstance: z.boolean({ message: "statusInstance is required" }),
      refreshToken: z.boolean({ message: "refreshToken is required" }),
    }),
  }),
});

export const webhookResponse = z.object({
  id: z.number(),
  url: z.string(),
  enabled: z.boolean(),
  events: z.object({
    qrcodeUpdated: z.boolean(),
    messagesSet: z.boolean(),
    messagesUpsert: z.boolean(),
    messagesUpdated: z.boolean(),
    sendMessage: z.boolean(),
    contactsSet: z.boolean(),
    contactsUpsert: z.boolean(),
    contactsUpdated: z.boolean(),
    chatsSet: z.boolean(),
    chatsUpsert: z.boolean(),
    chatsUpdated: z.boolean(),
    chatsDeleted: z.boolean(),
    presenceUpdated: z.boolean(),
    groupsUpsert: z.boolean(),
    groupsUpdated: z.boolean(),
    groupsParticipantsUpdated: z.boolean(),
    connectionUpdated: z.boolean(),
    statusInstance: z.boolean(),
    refreshToken: z.boolean(),
  }),
});

export const initStatusResponse = z.object({
  is_connected: z.boolean(),
});
