import { notifySlack } from "@/common/utils/slack";
import { WhatsappHelper } from "@/common/utils/whatsappHelper";
import { InstanceCache } from "@/common/utils/instanceCache";
import { logger } from "@/server";
import mongoose, { ConnectionStates, type FilterQuery, Schema, type Types, type UpdateQuery, model } from "mongoose";
import type { Document, Model, PipelineStage } from "mongoose";
import { InstanceConstants } from "../../constants/instanceConstants";
import type { Igroup } from "../groups/groupInterface";
import { EVENT_INSTANCE_CONNECTED, EVENT_INSTANCE_REMOVED, eventBus, eventConstructor } from "./events/eventBus";
import { fetchMobileFromInstanceJob } from "./jobs/fetchMobileFromInstanceJob";
import type {
  IGroup,
  IcreateUser,
  IgetScheduleFilter,
  Iinvitation,
  Imessage,
  Instance,
  IscheduleMessageReq,
  IscheduleMessageRes,
  IupdateUser,
  IupdatemessageObj,
  Iuser,
} from "./whatsappInterface";

const messageSchema = new Schema<Imessage>(
  {
    message: {
      type: String,
      required: true,
    },
    receiver_name: {
      type: String,
      required: true,
    },
    sender: {
      type: String,
      required: true,
      index: true,
    },
    receiver: {
      type: String,
      required: true,
      index: true,
    },
    message_type: {
      type: String,
      required: false,
      index: true,
    },
    retry_count: {
      type: Number,
      required: true,
      default: 0,
    },
    version: {
      type: Number,
      required: true,
      default: 0,
    },
    scheduled_at: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "success", "failed", "deleted"],
      default: "pending",
      index: true,
    },
    whatsapp_acknowledgement_id: {
      type: String,
    },
    media_type: {
      type: String,
    },
    media: {
      type: String,
    },
    file_name: {
      type: String,
    },
  },
  { timestamps: true },
);

const userSchema = new Schema<Iuser>(
  {
    mobile_number: {
      type: String,
      required: true,
      index: true,
    },
    instance_id: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      index: true,
      default: "OFFLINE",
    },
    allowed_message_count: {
      type: Number,
      default: -1,
    },
    invite_code: {
      type: String,
    },
    otp: {
      type: String,
    },
    group_permission: {
      type: Boolean,
      default: true,
    },
    is_new_user: {
      type: Boolean,
      default: true,
    },
    referred_users_count: {
      type: Number,
    },
    referred_by: {
      type: Schema.Types.ObjectId,
      ref: "users",
    },
    messages: [messageSchema],
    tag: [
      {
        name: { type: String, required: true },
        members: [
          {
            user_name: { type: String, required: true },
            mobile_number: { type: String, required: true },
            addedAt: { type: Date, default: Date.now },
          },
        ],
      },
    ],
    groups: [
      {
        message: { type: String, required: true },
        group_id: { type: String, required: true },
        delay: { type: Number, required: true },
        status: { type: String, required: true },
      },
    ],
  },
  { timestamps: true },
);

const instanceSchema = new Schema<Instance>(
  {
    uuid: {
      type: String,
      allowNull: false,
      index: true,
    },
    mobile_number: {
      type: String,
      allowNull: false,
      index: true,
    },
    status: {
      type: String,
      index: true,
      default: "OFFLINE",
    },
    initiated_at: {
      type: Date,
      allowNull: true,
    },
  },
  { timestamps: true },
);

const invitationSchema = new Schema<Iinvitation>(
  {
    referral: {
      type: Schema.Types.ObjectId,
      ref: "users",
    },
    referee: {
      type: Schema.Types.ObjectId,
      ref: "users",
    },
    status: {
      type: String,
      enum: ["pending", "sent", "success", "failed", "deleted"],
      index: true,
    },
  },
  { timestamps: true },
);

// Define a context to store old status
const preUpdateContext: { [key: string]: string | undefined } = {};

instanceSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const query = this.getQuery();
    const update: UpdateQuery<Iuser> = this.getUpdate() as UpdateQuery<Iuser>;

    // Fetch the document before updating
    const doc = await this.model.findOne(query).exec();

    // Store the old status in the context
    if (doc) {
      preUpdateContext[doc._id.toString()] = doc.status;
    }

    next();
  } catch (error: any) {
    next(error);
  }
});

instanceSchema.post("findOneAndUpdate", async function (doc, next) {
  try {
    const update: UpdateQuery<Iuser> = this.getUpdate() as UpdateQuery<Iuser>;
    if (doc) {
      // Retrieve the old status from the context
      const oldStatus = preUpdateContext[doc?._id.toString()];
      // Compare the old and new status
      if (oldStatus !== doc?.status) {
        let message: string;
        if (doc?.status === InstanceConstants.ONLINE) {
          message = `message:Existing user logged in \ninstance:${doc?.uuid}`;
        } else {
          message = `message:User logged out \ninstance:${doc?.uuid} \nmobile_number:${doc?.mobile_number}`;
        }

        // Trigger notification if status changed
        // await notifySlack(message);
      }
      // Clean up the context
      delete preUpdateContext[doc._id.toString()];
    }

    next();
  } catch (error: any) {
    next(error);
  }
});

export const User = model<Iuser>("users", userSchema);
export const WhatsappInstance = model<Instance>("instances", instanceSchema);
export const Invitation = model<Iinvitation>("invitations", invitationSchema);

export class WhatsappRepository {
  private whatappHelper: WhatsappHelper;

  constructor() {
    this.whatappHelper = new WhatsappHelper();
  }

  private async fetchAndCacheFreshInstance(instance_id: string, methodName: string): Promise<any | null> {
    logger.warn(`Cache miss for ${methodName} ${instance_id}, fetching fresh data from API`);
    try {
      const response = await this.whatappHelper.fetchInstance(instance_id);
      if (response && response.status === 200 && response.data?.[0]) {
        const instance = response.data[0];
        
        // Re-cache the fresh data
        const instanceCache = InstanceCache.getInstance();
        instanceCache.cacheFromAPI(instance);
        logger.info(`Fresh API data cached for ${methodName} ${instance_id}: ${instance.connectionStatus}`);
        
        return instance;
      }
    } catch (error) {
      logger.error(`API call failed for ${methodName} ${instance_id}, falling back to database: ${error}`);
    }
    
    logger.warn(`Using DB fallback for ${methodName} ${instance_id}`);
    return null;
  }

  async verifyUserConnection(instance_id: string): Promise<boolean | false> {
    //OPTIMIZATION: Check instance status from cache first
    const instanceCache = InstanceCache.getInstance();
    const isOnline = instanceCache.isInstanceOnline(instance_id);
    
    if (isOnline !== null) {
      logger.info(`Using cached status for verifyUserConnection ${instance_id}: ${isOnline ? 'online' : 'offline'}`);
      return isOnline;
    }
    
    // Cache miss: Try fresh API call with reusable method
    const freshInstance = await this.fetchAndCacheFreshInstance(instance_id, 'verifyUserConnection');
    if (freshInstance) {
      return freshInstance.connectionStatus === InstanceConstants.ONLINE;
    }
    
    // Final fallback: Check user status from database
    const user = await this.findUserByInstance(instance_id);
    if (!user) return false;
    return await this.isUserOnline(user);
  }

  async verifyInstanceConnection(instance_id: string): Promise<boolean | false> {
    //OPTIMIZATION: Check instance status from cache first
    const instanceCache = InstanceCache.getInstance();
    const isOnline = instanceCache.isInstanceOnline(instance_id);
    
    if (isOnline !== null) {
      logger.info(`Using cached status for verifyInstanceConnection ${instance_id}: ${isOnline ? 'online' : 'offline'}`);
      return isOnline;
    }
    
    // Cache miss: Try fresh API call to get latest status
    logger.warn(`Cache miss for verifyInstanceConnection ${instance_id}, fetching fresh data from API`);
    return await this.isInstanceConnected(instance_id);
  }

  async instanceStatus(instance_id: string): Promise<string | undefined> {
    //OPTIMIZATION: Check instance status from cache first
    const instanceCache = InstanceCache.getInstance();
    const isOnline = instanceCache.isInstanceOnline(instance_id);
    
    if (isOnline !== null) {
      const status = isOnline ? "open" : "close";
      logger.info(`Using cached status for instanceStatus ${instance_id}: ${status}`);
      return status;
    }
    
    // Cache miss: Try fresh API call with reusable method
    const freshInstance = await this.fetchAndCacheFreshInstance(instance_id, 'instanceStatus');
    if (freshInstance) {
      return freshInstance.connectionStatus === InstanceConstants.ONLINE ? "open" : "close";
    }
    
    // Final fallback: Check instance status from database
    const instance = await this.findInstance(instance_id);
    return instance?.status;
  }

  async userStatus(instance_id: string): Promise<string | undefined> {
    //OPTIMIZATION: Check instance status from cache first
    const instanceCache = InstanceCache.getInstance();
    const isOnline = instanceCache.isInstanceOnline(instance_id);
    
    if (isOnline !== null) {
      const status = isOnline ? "ONLINE" : "OFFLINE";
      logger.info(`Using cached status for userStatus ${instance_id}: ${status}`);
      return status;
    }
    
    // Cache miss: Try fresh API call with reusable method
    const freshInstance = await this.fetchAndCacheFreshInstance(instance_id, 'userStatus');
    if (freshInstance) {
      return freshInstance.connectionStatus === InstanceConstants.ONLINE ? "ONLINE" : "OFFLINE";
    }
    
    // Final fallback: Check user status from database
    const user = await this.findUserByInstance(instance_id);
    return user?.status;
  }

  async isInstanceConnected(instance_id: string): Promise<boolean | false> {
    const response = await this.whatappHelper.fetchInstance(instance_id);
    if (!response || response.status !== 200) return false;

    const instance = response.data[0];
    if (instance && (await this.isInstanceOnline(instance))) {
      await this.createOrUpdateUserFromInstance(instance, InstanceConstants.ONLINE);
      return true;
    }
    return false;
  }

  async isInstanceConnecting(instance: any): Promise<boolean | false> {
    return instance.connectionStatus === InstanceConstants.CONNECTING;
  }

  async isInstanceOnline(instance: any): Promise<boolean | false> {
    return instance.connectionStatus === InstanceConstants.ONLINE;
  }

  async notifyInstanceChange(state: string, mobile_number: string, instance_id: string) {
    // let message = null;
    switch (state) {
      case "logged_in":
        logger.info(`userLogin: ${instance_id} ${mobile_number}`);
        // message = `User logged in \n\`\`\`instance:${instance_id} \nmobile number:${mobile_number}\`\`\``;
        break;
      case "connecting":
        logger.info(`userConnecting: ${instance_id} ${mobile_number}`);
        // message = `User logged in \n\`\`\`instance:${instance_id} \nmobile number:${mobile_number}\`\`\``;
        break;
      default:
        logger.info(`userLogout: ${instance_id} ${mobile_number}`);
        // message = `User logged out \n\`\`\`instance:${instance_id} \nmobile number:${mobile_number}\`\`\``;
        break;
    }
    // await notifySlack(message);
  }

  async userConnecting(instance_id: string) {
    const isUserConnected = await this.verifyUserConnection(instance_id);
    if (isUserConnected) return;

    try {
      const instances = await this.whatappHelper.fetchInstance(instance_id);
      const instance = instances?.data?.[0];

      if (!instance) {
        logger.error(`No instance found for id: ${instance_id}`);
        return;
      }

      if (instance.ownerJid) {
        await this.createOrUpdateInstance(instance.name, { status: InstanceConstants.CONNECTING });
        await this.updateUserWithInstance(instance_id, { status: InstanceConstants.CONNECTING });
        await this.notifyInstanceChange("connecting", instance.ownerJid.replace("@s.whatsapp.net", ""), instance_id);
      }
    } catch (error) {
      logger.error(`Error while connecting user for instance ${instance_id}: ${error}`);
      if (error instanceof Error) {
        throw new Error(`Failed to connect user: ${error.message}`);
      }
      throw new Error("Failed to connect user: Unknown error occurred");
    }
  }

  async userConnected(instanceName: string) {
    await this.createOrUpdateInstance(instanceName, { status: InstanceConstants.ONLINE });
    await this.updateUserWithInstance(instanceName, { status: InstanceConstants.ONLINE });
  }

  async userLogin(instanceName: string) {
    await this.createOrUpdateInstance(instanceName, { status: InstanceConstants.CONNECTING });
    fetchMobileFromInstanceJob(instanceName);
  }

  async fetchMobileFromInstance(instance_name: string) {
    const instances = await this.whatappHelper.fetchInstance(instance_name);
    const instance = instances?.data?.[0];

    if (!(instance.connectionStatus === InstanceConstants.ONLINE)) return false;
    if (!instance.ownerJid) return false;
    
    logger.info(`=========OWNER JID FOUND FOR ${instance_name} : ${instance.ownerJid}==========`);

    const mobile_number = instance.ownerJid.replace("@s.whatsapp.net", "");
    await this.notifyInstanceChange("logged_in", mobile_number, instance_name);
    eventBus.emit("whatsapp_event", eventConstructor(EVENT_INSTANCE_CONNECTED, { instance_name, mobile_number }));
    return true;
  }

  async userLogout(instance_name: string) {
    eventBus.emit("whatsapp_event", eventConstructor(EVENT_INSTANCE_REMOVED, { instance_name }));
  }

  async createOrUpdateUserFromInstance(instance: any, status: string) {
    const mobile_number = instance.ownerJid.replace("@s.whatsapp.net", "");
    if (mobile_number)
      this.createOrUpdateUser(mobile_number, { instance_id: instance.name, status: InstanceConstants.ONLINE });
  }

  async createOrUpdateUser(mobile_number: string, data: IupdateUser) {
    let user = await this.findUser({ mobile_number });
    if (!user) {
      user = await this.createUser({ mobile_number });
      await notifySlack(`\`\`\`New User Signup : ${mobile_number}\`\`\``);
    }
    await this.updateUser(mobile_number, data);
  }

  async getInstance(uuid: string): Promise<Instance | null> {
    logger.info("get Instance called");
    return await WhatsappInstance.findOne({ uuid });
  }

  async createMessage(messageObj: IscheduleMessageReq): Promise<IscheduleMessageRes | null> {
    const user = await User.findOneAndUpdate(
      { mobile_number: messageObj.sender },
      {
        $push: {
          messages: {
            receiver_name: messageObj.receiver_name,
            message: messageObj.message,
            sender: messageObj.sender,
            receiver: messageObj.receiver,
            scheduled_at: messageObj.scheduled_at,
            file_name: messageObj.file_name,
            media: messageObj.media,
            media_type: messageObj.media_type,
            message_type: messageObj.message_type,
          },
        },
      },
      { new: true, fields: { messages: { $slice: -1 } } },
    );
    const result = user ? user?.messages[0] : null;
    return result;
  }

  async updateMessage(messageId: any, updateData: any) {
    try {
      const updateFields: { [key: string]: any } = {};
      for (const [key, value] of Object.entries(updateData)) {
        updateFields[`messages.$.${key}`] = value;
      }

      const updateOperation: any = {
        $set: {
          ...updateFields,
        },
        $inc: {
          "messages.$.version": 1, // Increment version
        },
      };

      const result = await User.findOneAndUpdate({ "messages._id": messageId }, updateOperation, { new: true });

      return result;
    } catch (error) {
      logger.error("Error in updateMessage function:", error);
      return null;
    }
  }

  async getMessages(scheduleFilter: IgetScheduleFilter) {
    const filter = {
      "messages.sender": scheduleFilter.sender,
      ...(scheduleFilter.status && { "messages.status": scheduleFilter.status }),
      ...(scheduleFilter.receiver && { "messages.receiver": scheduleFilter.receiver }),
    };
    const aggregateQuery: PipelineStage[] = [
      // Stage 1: Match documents based on sender and status
      {
        $match: filter,
      },
      // Stage 2: Unwind the messages array to process individual messages
      {
        $unwind: "$messages",
      },
      // Stage 3: Match individual messages based on sender and status
      {
        $match: filter,
      },
      // Stage 4: Facet stage to include both filtered messages and total count
      {
        $facet: {
          filteredMessages: [
            // Pipeline for filtered messages
            {
              $sort: { "messages.scheduled_at": -1 },
            },
            {
              $skip: scheduleFilter.skip,
            },
            {
              $limit: scheduleFilter.pageSize,
            },
            {
              $project: {
                _id: 0,
                messages: 1,
              },
            },
          ],
          totalCount: [
            // Pipeline to count total matching messages
            {
              $count: "count",
            },
          ],
        },
      },
    ];

    // Execute the aggregation
    const result = await User.aggregate(aggregateQuery).exec();

    // Extract filtered messages and total count from the result
    const filteredMessages = result[0].filteredMessages.flatMap((doc: { messages: any }) => doc.messages);
    const totalCount = result[0].totalCount.length > 0 ? result[0].totalCount[0].count : 0;
    const meta = { page: scheduleFilter.pageNo, pageSize: scheduleFilter.pageSize, totalRecords: totalCount };
    // Extract messages from filteredDocuments
    const messages = filteredMessages;
    return { messages, meta };
  }

  async findMessage(_id: string) {
    const objectId = new mongoose.Types.ObjectId(_id);
    const data = await User.aggregate([
      {
        $match: {
          "messages._id": objectId,
        },
      },
      {
        $project: {
          messages: {
            $filter: {
              input: "$messages",
              as: "message",
              cond: { $eq: ["$$message._id", objectId] },
            },
          },
        },
      },
    ]);
    return data;
  }

  async getMessage(instanceId?: string, messageId?: string): Promise<Imessage | null> {
    const user = await this.findUserByInstance(instanceId);
    if (!user) return null;

    const message = user.messages?.find((msg) => msg?._id?.toString() === messageId?.toString()) || null;
    return message;
  }

  async isUserOnline(user: Iuser): Promise<boolean> {
    return (user && user.status === InstanceConstants.ONLINE) || false;
  }

  async createUser(userObj: IcreateUser): Promise<Iuser | null> {
    return await User.create(userObj);
  }

  async updateUser(mobile_number: string, userObj: IupdateUser): Promise<Iuser | null> {
    return await User.findOneAndUpdate({ mobile_number }, userObj);
  }

  async updateUserWithInstance(instance_id: string, userObj: IupdateUser): Promise<Iuser | null> {
    return await User.findOneAndUpdate({ instance_id }, userObj);
  }

  async findUser(userObj: IcreateUser): Promise<Iuser | null> {
    return await User.findOne({ mobile_number: userObj.mobile_number });
  }

  async findUserByOtp(otp: string): Promise<Iuser | null> {
    return await User.findOne({ otp: otp });
  }

  async isUserContacted(sender: string, receiver: string): Promise<boolean | null> {
    const user = await this.findUser({ mobile_number: sender });
    if (!user) return null;
    return user.messages?.some((message) => message.receiver === receiver) || false;
  }

  async isUserContactedForGroup(sender: string, receiver: string, group_id: string): Promise<boolean | null> {
    const user = await this.findUser({ mobile_number: sender });
    if (!user) return null;
    
    // Check if any message to this receiver was a group welcome message for this specific group
    return user.messages?.some((message) => 
      message.receiver === receiver && 
      message.message_type === "Group Joinee Welcome" &&
      // Check if the message contains the group ID marker
      message.message.includes(`[GroupID:${group_id}]`)
    ) || false;
  }

  async findMessageByGroup(mobile_number: string, group_id: string): Promise<Igroup | undefined> {
    const user = await this.findUser({ mobile_number });
    if (!user) return undefined;

    // Use type intersection to preserve both Document and Iuser properties
    const userObj = (user as Document & Iuser).toObject();

    logger.info(`User : ${userObj} : ${typeof userObj}`);
    logger.info(`Mobile : ${JSON.stringify(userObj?.mobile_number)}`);
    logger.info(`Groups : ${userObj?.groups}`);
    logger.info(`Group ID : ${group_id}`);

    const group = userObj?.groups?.find(
      (group: Igroup) => group.status !== "inactive" && String(group.group_id) === String(group_id),
    );
    logger.info(`Group : ${JSON.stringify(group)}`);
    return group as Igroup | undefined;
  }

  async findMessageByGroupByInstance(instance_id: string, group_id: string): Promise<Igroup | undefined> {
    const user = await this.findUserByInstance(instance_id);
    if (!user) return undefined;

    // Use type intersection to preserve both Document and Iuser properties
    const userObj = (user as Document & Iuser).toObject();

    logger.info(`User found by instance_id: ${instance_id}`);
    logger.info(`Mobile : ${JSON.stringify(userObj?.mobile_number)}`);
    logger.info(`Groups : ${JSON.stringify(userObj?.groups)}`);
    logger.info(`Group ID : ${group_id}`);

    const group = userObj?.groups?.find(
      (group: Igroup) => group.status !== "inactive" && String(group.group_id) === String(group_id),
    );
    logger.info(`Group found: ${JSON.stringify(group)}`);
    return group as Igroup | undefined;
  }

  async findUserByInstance(instanceId?: string): Promise<Iuser | null> {
    return await User.findOne({ instance_id: instanceId });
  }

  async findOrCreateInstance(instanceId?: string): Promise<Instance | null> {
    let instance = await this.findInstance(instanceId);
    if (!instance) instance = await this.createInstance(instanceId);
    return instance;
  }

  async findInstance(instanceId?: string): Promise<Instance | null> {
    return await WhatsappInstance.findOne({ uuid: instanceId });
  }

  async createInstance(instanceName?: string): Promise<Instance | null> {
    return await WhatsappInstance.create({ uuid: instanceName });
  }

  async updateInstances(instance: string, instanceObj: Instance): Promise<Instance | null> {
    return await WhatsappInstance.findOneAndUpdate({ uuid: instance }, instanceObj, { new: true });
  }

  async updateInstance(mobile_number: string, instanceObj: Instance): Promise<Instance | null> {
    return await WhatsappInstance.findOneAndUpdate({ mobile_number: mobile_number }, instanceObj, { new: true });
  }

  async updateInstanceWithName(instanceName: string, instanceObj: Instance): Promise<Instance | null> {
    return await WhatsappInstance.findOneAndUpdate({ uuid: instanceName }, instanceObj);
  }

  async createOrUpdateInstance(instanceName: string, instanceObj: Instance): Promise<Instance | null> {
    let instance = await WhatsappInstance.findOne({ uuid: instanceName });
    if (!instance) instance = await WhatsappInstance.create({ uuid: instanceName });
    return await WhatsappInstance.findOneAndUpdate({ uuid: instanceName }, instanceObj);
  }

  async createInvitation(referral: string, referee: string, status: string): Promise<Iinvitation | null> {
    return await Invitation.create({ referral, referee, status });
  }

  async updateUserMessageStatus(instanceName: string, messageId: string, status: string): Promise<Iuser | null> {
    logger.info(`Updating message status ${status} for ${messageId}`);
    return await User.findOneAndUpdate(
      { "messages._id": messageId },
      {
        $set: { "messages.$.status": status },
        $inc: { "messages.$.version": 1 },
      },
      { new: true },
    );
  }
}
