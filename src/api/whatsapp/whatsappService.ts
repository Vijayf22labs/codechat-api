import { WhatsappRepository } from "@/api/whatsapp/whatsappRepository";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { log } from "@/common/utils/logger";
import { uploadToS3 } from "@/common/utils/s3";
import { addMessageToQueue } from "@/common/utils/schedulerQueue";
import { notifySlack } from "@/common/utils/slack";
import { WhatsappHelper } from "@/common/utils/whatsappHelper";
import { whatsappWrapper, whatsappWrapperNew } from "@/common/utils/whatsappWrapper";
import { InstanceCache } from "@/common/utils/instanceCache";
import { InstanceConstants } from "@/constants/instanceConstants";
import { logger } from "@/server";
import axios from "axios";
import { StatusCodes } from "http-status-codes";
import { v4 as uuidv4 } from "uuid";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

import type {
  IMessage,
  IcreateUser,
  IgetScheduleFilter,
  Iinstance,
  Iinvitation,
  Instance,
  Iresponse,
  IscheduleMessageReq,
  IscheduleMessageRes,
  IupdatemessageObj,
  IuserStatus,
  LoginQR,
  LoginQRVerifyResponse,
} from "./whatsappInterface";
import type { ConnectInstanceResponse } from "./whatsappModel";

// import { EVENT_INSTANCE_INIT, EVENT_INSTANCE_REMOVED, eventBus, eventConstructor } from "./events/eventBus";
import { EVENT_INSTANCE_INIT, EVENT_INSTANCE_CONNECTED, EVENT_INSTANCE_REMOVED, eventBus, eventConstructor } from "./events/eventBus";
import { BadRequestException, CustomException, NotFoundException } from "@/common/exception";

export class WhatsappService {
  private whatsappHelper: WhatsappHelper;
  private whatsappRepository: WhatsappRepository;
  private instanceCache: InstanceCache;

  constructor(
    repository: WhatsappRepository = new WhatsappRepository(),
    whatsapphelperFunc: WhatsappHelper = new WhatsappHelper(),
  ) {
    this.whatsappHelper = whatsapphelperFunc;
    this.whatsappRepository = repository;
    this.instanceCache = InstanceCache.getInstance();
  }

  private async getCachedOrFreshStatus(instance_id: string, methodName: string): Promise<boolean> {
    //OPTIMIZATION: Check instance status from cache first
    const isOnline = this.instanceCache.isInstanceOnline(instance_id);
    
    if (isOnline !== null) {
      logger.info(`Using cached status for ${methodName} ${instance_id}: ${isOnline ? 'online' : 'offline'}`);
      return isOnline;
    }
    
    // AGGRESSIVE CACHING: Only fetch fresh data if cache is completely empty
    logger.warn(`Cache miss for ${methodName} ${instance_id}, fetching fresh data from API`);
    try {
      const response = await this.whatsappHelper.fetchInstance(instance_id);
      if (response && response.status === 200 && response.data?.[0]) {
        const instance = response.data[0];
        
        // Re-cache the fresh data with extended TTL
        this.instanceCache.cacheFromAPI(instance);
        logger.info(`Fresh API data cached for ${methodName} ${instance_id}: ${instance.connectionStatus}`);
        
        return instance.connectionStatus === InstanceConstants.ONLINE;
      }
    } catch (error) {
      // FAST FAIL: Don't retry, just return cached result or false
      logger.error(`API call failed for ${methodName} ${instance_id}: ${error}`);
      
      // Return last known cached status even if stale
      const staleStatus = this.instanceCache.getStaleStatus(instance_id);
      if (staleStatus !== null) {
        logger.warn(`Using stale cached status for ${methodName} ${instance_id}: ${staleStatus ? 'online' : 'offline'}`);
        return staleStatus;
      }
    }
    
    // Final fallback: return false if everything fails
    logger.warn(`All status checks failed for ${methodName} ${instance_id}, returning false`);
    return false;
  }

  async init(
    instancename?: string,
    description?: string,
  ): Promise<ServiceResponse<ConnectInstanceResponse | { token: string } | null>> {
    let instanceName = instancename as string;
    if (!instancename) instanceName = uuidv4();

    let instance = null;
    try {
      instance = await this.fetchOrCreateInstance(instanceName, description);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error?.response?.status === 403 || error?.response?.status === 409) {
          return ServiceResponse.failure("Generate new Instance!!", null, StatusCodes.REQUEST_TIMEOUT);
        }
      }
    }

    if (!instance) return ServiceResponse.failure("Generate new Instance!!", null, StatusCodes.REQUEST_TIMEOUT);
    await this.whatsappRepository.findOrCreateInstance(instanceName);

    if (instance.connectionStatus === "ONLINE") {
      await this.whatsappRepository.userConnected(instanceName);
      
      //EXTENSION REINSTALL FIX: Clear cache and update status for fresh extension installations
      const cache = InstanceCache.getInstance();
      cache.clearInstanceCache(instanceName);
      cache.updateConnectionStatus(instanceName, "ONLINE");
      logger.info(`Cleared cache and updated status for extension reinstall: ${instanceName}`);
      
      //Return token for already connected instances during extension reinstall
      return ServiceResponse.success<ConnectInstanceResponse>("Instance Already Connected - Extension Reinstalled", {
        count: 0,
        base64: "",
        code: instance.Auth?.token || "",
        instanceName
      });
    }

    //NORMAL CACHING: Cache the instance data for non-ONLINE instances
    const cache = InstanceCache.getInstance();
    cache.cacheFromAPI(instance);
    logger.info(`Cached instance data for ${instanceName} during init`);

    const connectInstanceResponse = await whatsappWrapper(
      this.whatsappHelper.connectInstance(instanceName, instance.Auth.token),
    );
    await whatsappWrapper(this.whatsappHelper.registerWebhook(instanceName, instance.Auth.token));
    eventBus.emit("whatsapp_event", eventConstructor(EVENT_INSTANCE_INIT, { instance_name: instanceName }));

    return ServiceResponse.success<ConnectInstanceResponse>("QrCode Generated", {
      ...connectInstanceResponse,
      instanceName,
    });
  }

  async deleteInstance(instanceName: string) {
    //OPTIMIZATION: Try to get auth token from cache first
    let authToken = this.instanceCache.getAuthToken(instanceName);
    
    if (!authToken) {
      logger.warn(`No cached auth token for ${instanceName}, falling back to API polling`);
      try {
        const instances = await whatsappWrapper(this.whatsappHelper.fetchInstance(instanceName));
        authToken = instances[0].Auth.token;
      } catch (error: any) {
        if (axios.isAxiosError(error) && error?.response?.status === 400) {
          logger.info(`400 error in deleteInstance for ${instanceName}, treating as already connected`);
          return; // Instance might already be deleted or in invalid state
        }
        throw error;
      }
    } else {
      logger.info(`Using cached auth token for deleteInstance: ${instanceName}`);
    }
    
    if (!authToken) throw new Error("Auth token not available");
    await whatsappWrapper(this.whatsappHelper.deleteInstance(instanceName, authToken));
  }

  async unRegisterWebhook(instanceName: string) {
    //OPTIMIZATION: Try to get auth token from cache first
    let authToken = this.instanceCache.getAuthToken(instanceName);
    
    if (!authToken) {
      logger.warn(`No cached auth token for ${instanceName}, falling back to API polling`);
      try {
        const instances = await whatsappWrapper(this.whatsappHelper.fetchInstance(instanceName));
        authToken = instances[0].Auth.token;
      } catch (error: any) {
        if (axios.isAxiosError(error) && error?.response?.status === 400) {
          logger.info(`400 error in unRegisterWebhook for ${instanceName}, treating as already connected`);
          return; // Instance might be in invalid state
        }
        throw error;
      }
    } else {
      logger.info(`Using cached auth token for unRegisterWebhook: ${instanceName}`);
    }
    
    if (!authToken) throw new Error("Auth token not available");
    await whatsappWrapper(this.whatsappHelper.unRegisterWebhook(instanceName, authToken));
  }

  async registerWebhook(instanceName: string) {
    //OPTIMIZATION: Try to get auth token from cache first
    let authToken = this.instanceCache.getAuthToken(instanceName);
    
    if (!authToken) {
      logger.warn(`No cached auth token for ${instanceName}, falling back to API polling`);
      try {
        const instances = await whatsappWrapper(this.whatsappHelper.fetchInstance(instanceName));
        authToken = instances[0].Auth.token;
        // Cache the result for future use
        this.instanceCache.cacheFromAPI(instances[0]);
      } catch (error: any) {
        if (axios.isAxiosError(error) && error?.response?.status === 400) {
          logger.info(`400 error in registerWebhook for ${instanceName}, treating as already connected`);
          return; // Instance might be in invalid state
        }
        throw error;
      }
    } else {
      logger.info(`Using cached auth token for registerWebhook: ${instanceName}`);
    }
    
    if (!authToken) throw new Error("Auth token not available");
    await whatsappWrapper(this.whatsappHelper.registerWebhook(instanceName, authToken));
    return ServiceResponse.success<any | null>("Webhook Registered!!", {});
  }

  async fetchOrCreateInstance(instanceName: string, description?: string): Promise<Iinstance | null> {
    try {
      const instances = await whatsappWrapper(this.whatsappHelper.fetchInstance(instanceName));
      if (instances.length > 0) return instances[0];
      return await whatsappWrapper(this.whatsappHelper.createInstance(instanceName, description));
    } catch (error: any) {
      if (error?.response?.status === 403) {
        throw error;
      }
    }
    return null;
  }

  async handleDeliverMessage(instanceName: string, messageId: string): Promise<ServiceResponse<Iresponse | null>> {
    logger.info(`Executing handleDeliverMessage for ${messageId}`);
    const response = await this.deliverMessage(instanceName, messageId);
    await this.whatsappRepository.updateUserMessageStatus(
      instanceName,
      messageId,
      response.success ? "success" : "failed",
    );
    if (response.success) return ServiceResponse.success<any | null>(response.message, {});
    return ServiceResponse.failure(response.message, null, StatusCodes.BAD_REQUEST);
  }

  async deliverMessage(instanceName: string, messageId: string): Promise<Iresponse> {
    logger.info(`Executing deliverMessage for ${messageId}`);
    let user = await this.whatsappRepository.findUserByInstance(instanceName);
    if (!user) return { success: false, message: "User not found" };

    const message = user.messages?.find((msg) => msg._id?.toString() === messageId.toString());
    if (!message) return { success: false, message: "Message not found" };

    //OPTIMIZATION: Try to get auth token from cache first
    let authToken = this.instanceCache.getAuthToken(instanceName);
    
    if (!authToken) {
      logger.warn(`No cached auth token for ${instanceName}, falling back to API polling`);
      try {
        const instances = await whatsappWrapper(this.whatsappHelper.fetchInstance(instanceName));
        const instance = instances[0];

        //Before Migration fix
        // if (!instance) return { success: false, message: "Instance not found" };
        //

        // TODO: TEMPORARY MIGRATION FIX - Should be removed after migration fix (Est: 30-60 days)
        if (!instance) {
          // DATABASE MIGRATION FIX: Instance not found in PostgreSQL (CodeChat)
          logger.warn(`PostgreSQL instance ${instanceName} not found during message delivery - database migration issue detected`);
          
          // Clear cache and reset MongoDB status to OFFLINE
          this.instanceCache.clearInstanceCache(instanceName);
          await this.whatsappRepository.userLogout(instanceName);
          
          logger.info(`Cleared cache and set MongoDB status to OFFLINE for ${instanceName} - forcing reconnection`);
          return { success: false, message: "Instance disconnected due to system upgrade. Please reconnect by clicking 'Schedule Message' again." };
        }
        // Remove till this line after migration fix
        
        authToken = instance.Auth?.token;
        // Cache the result for future use
        this.instanceCache.cacheFromAPI(instance);
      } catch (error: any) {
        if (axios.isAxiosError(error) && error?.response?.status === 400) {
          logger.info(`400 error in deliverMessage for ${instanceName}, treating as already connected`);
          return { success: false, message: "Instance connection issue - please retry" };
        }
        
        throw error;
      }
    } else {
      logger.info(`Using cached auth token for ${instanceName}`);
    }

    if (!authToken) return { success: false, message: "Auth token not available" };

    const messageBody = {
      instance_id: instanceName,
      token: authToken,
      message: message.message,
      receiver: message.receiver,
      attr: `${message.sender}::${message._id}`,
    };

    let response = null;
    if (!message.media) {
      log(`Executing sendText for ${messageId}`);
      response = await whatsappWrapperNew(this.whatsappHelper.sendText(messageBody));
    } else {
      log(`Executing sendMedia for ${messageId}`);
      response = await whatsappWrapperNew(
        this.whatsappHelper.sendMedia(
          Object.assign(messageBody, {
            media_type: message.media_type,
            media: message.media,
            file_name: message.file_name,
          }),
        ),
      );
    }

    if (response.status !== 200 && response.status !== 201)
      return { success: false, message: "MESSAGE DELIVERY FAILED" };
    return { success: true, message: "Message Delivered" };
  }

  async createScheduleMessage(data: IscheduleMessageReq): Promise<ServiceResponse<IscheduleMessageRes | null>> {
    if (data.receiver.startsWith("972")) {
      return ServiceResponse.failure("Unable to perform this action", null, StatusCodes.FORBIDDEN);
    }
    
    let media = "";
    if (data.media_type) {
      media = (await uploadToS3(data.file)) as string;
    }

    const messageData = {
      ...data,
      receiver: data.receiver.split("@c.us")[0],
      media: media || undefined,
    };
    const message = await this.whatsappRepository.createMessage(messageData);
    const schedueTime = new Date(data.scheduled_at);
    if (!message) {
      return ServiceResponse.failure("User not found", null, StatusCodes.NOT_FOUND);
    }
    logger.info(`addMessageToQueue ${message?._id} ${message?.version} ${message?.receiver} ${schedueTime}`);
    addMessageToQueue(message?._id, message?.version, schedueTime);
    await notifySlack(`\`\`\`${data.message_type} message by : ${data.sender} to ${messageData.receiver}\`\`\``);
    return ServiceResponse.success<IscheduleMessageRes | null>("scheduled created successfully!!", message);
  }

  async updateSchedule(messageId: string, messageObj: IMessage): Promise<ServiceResponse<IupdatemessageObj | null>> {
    try {
      if (messageObj.media_status === "added") {
        if (messageObj.media_type) {
          const imageURL = (await uploadToS3(messageObj.file)) as string;
          messageObj.media = imageURL;
        }
      } else if (messageObj.media_status === "deleted") {
        messageObj.media = "";
        messageObj.media_type = "";
        messageObj.file_name = "";
      }

      messageObj.receiver = messageObj.receiver.split("@c.us")[0];

      log(`Updated message : ${JSON.stringify(messageObj)}`);

      await this.whatsappRepository.updateMessage(messageId, messageObj);
      const message = await this.whatsappRepository.getMessage(messageObj?.user?.instance_id, messageId);
      addMessageToQueue(message?._id, message?.version, new Date(messageObj.scheduled_at));
      return ServiceResponse.success<IupdatemessageObj | null>("schedule updated successfully!!", { id: messageId });
    } catch (e) {
      const errorMessage = `Error in update schedule function:, ${(e as Error).message}`;
      logger.error(errorMessage);
      return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async getScheduleMessage(scheduleFilter: IgetScheduleFilter) {
    try {
      const response: any = await this.whatsappRepository.getMessages(scheduleFilter);
      return ServiceResponse.success<IupdatemessageObj | null>("schedule retrived successfully!!", response);
    } catch (e) {
      const errorMessage = `Error in get schedule function:, ${(e as Error).message}`;
      logger.error(errorMessage);
      return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async deleteSchedule(messageId: string): Promise<ServiceResponse<IupdatemessageObj | null>> {
    try {
      await this.whatsappRepository.updateMessage(messageId, {
        status: "deleted",
      });
      return ServiceResponse.success<IupdatemessageObj | null>("message deleted successfully!!", { id: messageId });
    } catch (e) {
      const errorMessage = `Error in delete schedule function:, ${(e as Error).message}`;
      logger.error(errorMessage);
      return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async instanceStatus(uuid: string): Promise<ServiceResponse<Instance | null>> {
    if (uuid === "null") return ServiceResponse.failure<Instance>("Instance not found", { status: undefined }, 400);

    //OPTIMIZATION: Check cache first for real-time status
    const cachedStatus = this.instanceCache.isInstanceOnline(uuid);
    if (cachedStatus !== null) {
      const status = cachedStatus ? InstanceConstants.ONLINE : InstanceConstants.OFFLINE;
      logger.info(`Using cached status for instance ${uuid}: ${status}`);
      return ServiceResponse.success<Instance>(`Instance ${status}`, {
        status: status,
      });
    }

    // FAST OPTIMIZATION: Try fresh API call first (usually faster than DB)
    logger.warn(`Cache miss for instance ${uuid}, trying API first`);
    try {
      const response = await this.whatsappHelper.fetchInstance(uuid);
      if (response && response.status === 200 && response.data?.[0]) {
        const instance = response.data[0];
        
        // Cache the fresh data for next time
        this.instanceCache.cacheFromAPI(instance);
        logger.info(`Fresh API data cached for instanceStatus ${uuid}: ${instance.connectionStatus}`);
        
        const status = instance.connectionStatus === InstanceConstants.ONLINE ? InstanceConstants.ONLINE : InstanceConstants.OFFLINE;
        return ServiceResponse.success<Instance>(`Instance ${status}`, {
          status: status,
        });
      }
    } catch (error) {
      //Before Migration fix 
      //logger.warn(`API call failed for instanceStatus ${uuid}, falling back to database: ${error}`);
      //
      
      // TODO: TEMPORARY MIGRATION FIX - Should be removed after migration fix (Est: 30-60 days)
      logger.warn(`API call failed for instanceStatus ${uuid}, checking database fallback: ${error}`);   
      // DATABASE MIGRATION FIX: Handle 404 errors during status check
      if (axios.isAxiosError(error) && error?.response?.status === 404) {
        logger.warn(`404 error in instanceStatus for ${uuid} - PostgreSQL instance missing (migration issue)`);
        
        // Check if MongoDB still shows ONLINE but PostgreSQL is missing
        const dbInstance = await this.whatsappRepository.findInstance(uuid);
        if (dbInstance?.status === InstanceConstants.ONLINE) {
          logger.warn(`Database migration mismatch detected: MongoDB ONLINE but PostgreSQL missing for ${uuid}`);
          
          // Clear cache and reset MongoDB status to OFFLINE
          this.instanceCache.clearInstanceCache(uuid);
          await this.whatsappRepository.userLogout(uuid);
          
          logger.info(`Reset ${uuid} status due to database migration - forcing reconnection`);
          return ServiceResponse.failure<Instance>("INSTANCE_DISCONNECTED", {
            status: InstanceConstants.OFFLINE
          }, 410); // 410 Gone - triggers reconnection flow
        }
      }
      //Remove till this line after migration fix
    }

    // Fallback to database only if API fails
    const instance = await this.whatsappRepository.findInstance(uuid);

    if (instance?.status !== InstanceConstants.ONLINE && instance?.initiated_at) {
      logger.info(`Time : ${instance?.initiated_at} - ${new Date(new Date().getTime() - 5 * 60 * 1000)}`);
      if (instance?.initiated_at <= new Date(new Date().getTime() - 5 * 60 * 1000)) {
        return ServiceResponse.failure<Instance>("Instance connection timeout", {}, 408);
      }
    }
    return ServiceResponse.success<Instance>(`Instance ${instance?.status || InstanceConstants.OFFLINE}`, {
      status: instance?.status || InstanceConstants.OFFLINE,
    });
  }

  async userStatus(uid: string): Promise<ServiceResponse<IuserStatus | null>> {
    if (uid === "null") return ServiceResponse.success<IuserStatus>("Invalid instance", { status: undefined });
    
    //OPTIMIZATION: Use cache-first status checking with fresh API fallback
    const isOnline = await this.getCachedOrFreshStatus(uid, 'userStatus');
    const status = isOnline ? "ONLINE" : "OFFLINE";
    
    const user = await this.whatsappRepository.findUserByInstance(uid);
    const is_new_user = user?.is_new_user;
    if (is_new_user) await this.whatsappRepository.updateUserWithInstance(uid, { is_new_user: false });
    
    return ServiceResponse.success<IuserStatus>(`Instance ${status}`, { status, is_new_user });
  }

  async handleGroupParticipantsUpdate(instance: any, data: any) {
    if (data.action === "add") {
      await whatsappServiceInstance.handleGroupUserAddition(instance, data);
    } else if (data.action === "remove") {
      // await whatsappServiceInstance.handleLogout(instance.name);
    }
  }

  async handleInstanceRemoval(instance: any, data: any) {
    if (data.status === "removed") {
      eventBus.emit("whatsapp_event", eventConstructor(EVENT_INSTANCE_REMOVED, { instance_name: instance.name }));

      await whatsappServiceInstance.unRegisterWebhook(instance.name);
      // await whatsappServiceInstance.deleteInstance(instance.name);
      await this.whatsappRepository.userLogout(instance.name);
    }
  }

  async handleMessageDelivery(instance: any, data: any) {
    const attribs = data.externalAttributes;
    // Extract MongoDB message ID from externalAttributes (format: "sender::messageId")
    if (attribs && attribs.includes("::")) {
      const mongoMessageId = attribs.split("::")[1];
      this.whatsappRepository.updateUserMessageStatus(instance.name, mongoMessageId, "success");
    }
    // this.whatsappRepository.updateUserMessageStatus(instance.name, data.keyId, "success");
  }

  async removeUnusedInstances() {
    try {
      const instances = await whatsappWrapper(this.whatsappHelper.fetchInstance());
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      for (const instance of instances) {
        const createdAt = new Date(instance.createdAt);
        if (createdAt <= oneDayAgo && instance.connectionStatus === InstanceConstants.OFFLINE && !instance.ownerJid) {
          logger.info(
            `${instance.name} created at ${createdAt} with status ${instance.connectionStatus} and ownerJID ${instance.ownerJid}`,
          );
          await whatsappWrapper(this.whatsappHelper.unRegisterWebhook(instance.name, instance.Auth.token));
          // await whatsappWrapper(this.whatsappHelper.deleteInstance(instance.name, instance.Auth.token));
          await this.whatsappRepository.userLogout(instance.name);
          await sleep(1000);
        }
      }
    } catch (error) {
      logger.error("Error unregistering webhook:", error);
    }
  }

  async handleConnectionUpdate(instance: any, data: any) {
    logger.info(`New connection state for ${instance.name}: ${data.state}`);
    
    //OPTIMIZATION: Cache instance data from webhook for future use
    this.instanceCache.cacheFromWebhook(instance);
    
    switch (data.state) {
      case "open": 
        // Update cache with ONLINE status
        this.instanceCache.updateConnectionStatus(instance.name, "ONLINE");
        
        // Extract mobile number directly from webhook data
        const mobile_number = instance.ownerJid?.replace("@s.whatsapp.net", "");
        
        // Update instance status to ONLINE
        await this.whatsappRepository.createOrUpdateInstance(instance.name, { 
          status: InstanceConstants.ONLINE 
        });
        
        // Handle mobile number logic based on availability
        if (mobile_number) {
          // Mobile number available in webhook (existing instance reconnection)
          logger.info(`..............Mobile number available in webhook for ${instance.name}: ${mobile_number}..............`);
          await this.whatsappRepository.createOrUpdateUser(mobile_number, {
            instance_id: instance.name,
            status: InstanceConstants.ONLINE
          });
          
          // Emit event for logging/notifications
          eventBus.emit("whatsapp_event", eventConstructor(EVENT_INSTANCE_CONNECTED, { 
            instance_name: instance.name, 
            mobile_number 
          }));
          
          await this.whatsappRepository.notifyInstanceChange("logged_in", mobile_number, instance.name);
        } else {
          // Mobile number not in webhook - need to poll API for fresh mobile number
          logger.info(`..............Mobile number not in webhook for ${instance.name} - polling API for mobile number..............`);
          logger.info(`..............Executing userLogin polling attempt 1 for ${instance.name} with webhook fallback..............`);
          const pollingStartTime = Date.now();
          logger.info(`..............WEBHOOK POLLING START: Initiating userLogin API call for ${instance.name} at ${new Date().toISOString()}..............`);

          await this.whatsappRepository.userLogin(instance.name);
          
          const pollingEndTime = Date.now();
          const pollingDuration = pollingEndTime - pollingStartTime;
          logger.info(`..............WEBHOOK POLLING COMPLETE: userLogin API call took ${pollingDuration}ms for ${instance.name}..............`);
          logger.info(`..............userLogin polling completed for ${instance.name} in ${pollingDuration}ms..............`);
          logger.info(`..............completed..............`);

          if (pollingDuration > 1000) {
            logger.warn(`..............LOW WEBHOOK POLLING DETECTED: userLogin for ${instance.name} took ${pollingDuration}ms (${(pollingDuration/1000).toFixed(2)}s)..............`);
          }
        }
        break;
      case "connecting":
        // Update cache with CONNECTING status
        this.instanceCache.updateConnectionStatus(instance.name, "CONNECTING");
        await this.whatsappRepository.userConnecting(instance.name);
        break;
      case "close":
        // Update cache with OFFLINE status
        this.instanceCache.updateConnectionStatus(instance.name, "OFFLINE");
        await this.whatsappRepository.userLogout(instance.name);
        break;
    }
  }

  async handleRefreshToken(instance: any, data: any) {
    logger.info(`Auth token refreshed for instance ${instance.name}`);
    
    //OPTIMIZATION: Update cached auth token from webhook
    if (data.token) {
      this.instanceCache.updateAuthToken(instance.name, data.token);
      logger.info(`Updated cached auth token for ${instance.name}`);
    } else if (instance.Auth?.token) {
      // Fallback: use token from instance object
      this.instanceCache.updateAuthToken(instance.name, instance.Auth.token);
      logger.info(`Updated cached auth token from instance object for ${instance.name}`);
    }
  }

  async handleGroupUserAddition(instance: any, data: any) {
    const sender = instance.ownerJid.replace("@s.whatsapp.net", "");
    const instance_id = instance.name;

    // FIX: Extract clean group ID from compound format
    const rawGroupId = data.id;
    const groupId = rawGroupId.includes('_') ? 
      rawGroupId.split('_').find((part: string) => part.includes('@g.us')) || rawGroupId :
      rawGroupId;

    logger.info(`=== GROUP LOOKUP DEBUG ===`);
    logger.info(`Sender (mobile): ${sender}`);
    logger.info(`Instance ID: ${instance_id}`);
    logger.info(`Raw Group ID: ${rawGroupId}`);
    logger.info(`Clean Group ID: ${groupId}`);
    logger.info(`========================`);
    
    // FIX: Use instance_id lookup instead of mobile number lookup
    const groupObj = await this.whatsappRepository.findMessageByGroupByInstance(instance_id, groupId);
    logger.info(`${sender} ${groupId} ${groupObj?.message}`);
    if (!groupObj || !groupObj.message) {
      logger.warn(`No group configuration found for instance: ${instance_id}, group: ${groupId}`);
      return;
    }

    logger.info(`Group configuration found! Message: ${groupObj.message}`);

    for (const participant of data.participants) {
      const receiver = participant.replace("@s.whatsapp.net", "");
      logger.info(`Processing participant: ${receiver}`);
      
      // Check if this user already received a welcome message for this specific group
      const hasReceivedWelcome = await this.whatsappRepository.isUserContactedForGroup(sender, receiver, groupId);
      
      if (hasReceivedWelcome) {
        logger.info(`User ${receiver} already received welcome message for group ${groupId}, skipping...`);
        continue;
      }
      
      logger.info(`Creating welcome message for ${receiver} in group ${groupId} (first time)`);
      
      await whatsappServiceInstance.createScheduleMessage({
        sender: sender,
        receiver: receiver,
        message: `${groupObj.message} [GroupID:${groupId}]`, // Add group ID for tracking duplicates
        message_type: "Group Joinee Welcome",
        scheduled_at: groupObj.delay !== undefined && groupObj.delay > 0
          ? new Date(new Date().getTime() + groupObj.delay * 60 * 1000).toISOString()
          : new Date().toISOString(), // Immediate delivery for delay=0
      });
      
      logger.info(`Welcome message scheduled for ${receiver} in group ${groupId}`);
    }
  }

  async handleLogin(instance: string) {
    await this.whatsappRepository.userLogin(instance);
  }

  async handleLogout(instance: string) {
    await this.whatsappRepository.userLogout(instance);
  }

  async updateInstanceStatus(fields: Iinstance, instance: string) {
    return await this.whatsappRepository.updateInstances(instance, fields);
  }

  async createUser(userObj: IcreateUser) {
    try {
      const user = await this.whatsappRepository.findUser(userObj);
      if (user) return;
      await this.whatsappRepository.createUser(userObj);
      return;
    } catch (e) {
      const errorMessage = `Error in create user function: ${(e as Error).message}`;
      logger.error(errorMessage);
    }
  }

  async createInvitation(
    referral: string,
    referee: string,
    status: string,
  ): Promise<ServiceResponse<Iinvitation | null>> {
    try {
      const invitation = await this.whatsappRepository.createInvitation(referral, referee, status);
      return ServiceResponse.success<Iinvitation | null>("invitation created successfully!!", invitation);
    } catch (e) {
      const errorMessage = `Error in create invitation function: ${(e as Error).message}`;
      logger.error(errorMessage);
      return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async generateMobileQR(instance_id: string): Promise<ServiceResponse<LoginQR | null>> {
    try {
      const QRCode = require("qrcode");
      
      //OPTIMIZATION: Use cache-first status checking with fresh API fallback
      const isOnline = await this.getCachedOrFreshStatus(instance_id, 'generateMobileQR');
      if (!isOnline) {
        throw new CustomException("Instance not online", StatusCodes.FORBIDDEN);
      }
      
      const user = await this.whatsappRepository.findUserByInstance(instance_id);
      if (!user) {
        throw new CustomException("User not found for instance", StatusCodes.NOT_FOUND);
      }
      
      const jwt = require("jsonwebtoken");
      const payload = {
        mobile: user.mobile_number,
        instance: user.instance_id,
      };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 600 });
      const url = `${process.env.PWA_URL}?token=${token}`;
      const qrCodeDataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: "H" });
      return ServiceResponse.success<LoginQR | null>("QR generated successfully!!", { qr_code: qrCodeDataUrl });
    } catch (e) {
      if (e instanceof CustomException) return ServiceResponse.failure(e.message, null, e.statusCode);
    }
    return ServiceResponse.failure("Unknown error occurred", null, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  async verifyLogin(token: string): Promise<ServiceResponse<LoginQRVerifyResponse | null>> {
    try {
      const jwt = require("jsonwebtoken");
      const decoded = jwt.verify(token, process.env.JWT_SECRET, (err: any, decoded: any) => {
        if (err) {
          logger.error("JWT verification error:", err);
        }
        return decoded;
      });
      if (!decoded?.instance) throw new CustomException("Invalid token", StatusCodes.BAD_REQUEST);
      return ServiceResponse.success<LoginQRVerifyResponse | null>("Login Successful", { instance: decoded?.instance });
    } catch (err) {
      if (err instanceof CustomException) return ServiceResponse.failure(err.message, null, err.statusCode);
    }
    return ServiceResponse.failure("Unknown error occurred", null, StatusCodes.INTERNAL_SERVER_ERROR);
  }

  async verifyOtp(mobile_number: string, otp: string): Promise<LoginQRVerifyResponse | null> {
    const user = await this.whatsappRepository.findUser({mobile_number});
    if (!user) throw new NotFoundException("User not found");
    if (user.otp !== otp) throw new BadRequestException("Invalid input");
    return { instance: user.instance_id }
  }
}

export const whatsappServiceInstance = new WhatsappService();
