import type { IMessageMeta } from "@/api/whatsapp/whatsappInterface";
import { logger } from "@/server";
import schedule from "node-schedule";
import { WhatsappRepository } from "../../api/whatsapp/whatsappRepository";
import { log } from "./logger";
import { notifySlack } from "./slack";
import { WhatsappHelper } from "./whatsappHelper";
import { InstanceCache } from "./instanceCache";
import { whatsappWrapper, whatsappsend } from "./whatsappWrapper";
interface ScheduleJobParams {
  _id: string;
  message: string;
  version: number;
  receiver: string;
  scheduled_at: Date;
  instanceName: string;
  mobile_number: string;
}

export async function checkingVersion(_id: string, version: number) {
  const whatsappRepository = new WhatsappRepository();
  const checkVersion = await whatsappRepository.findMessage(_id);
  if (checkVersion[0]?.messages[0].version === version && checkVersion[0]?.messages[0].status === "pending") {
    return true;
  }
  return false;
}

export async function notifyDeliveryStatus(
  message: string,
  instance: string,
  messageMeta: IMessageMeta,
  response?: any,
) {
  const finalMessage = `${message}\n\`\`\`id: ${messageMeta._id}\nsender: ${messageMeta.sender}\nreceiver: ${messageMeta.receiver}\nmessageType: ${messageMeta.message_type}\ninstance: ${instance}\`\`\``;
  log(finalMessage);
  if (message.includes("MESSAGE DELIVERY FAILED")) await notifySlack(finalMessage);
}

export async function deliverMessage(_id: any, version: number) {
  const whatsappHelper = new WhatsappHelper();
  const whatsappRepository = new WhatsappRepository();
  const instanceCache = InstanceCache.getInstance();
  
  try {
    const scheduleMessages = await whatsappRepository.findMessage(_id);
    
    // Add proper error handling for message retrieval
    if (!scheduleMessages || scheduleMessages.length === 0) {
      console.error(`No schedule messages found for ID: ${_id}`);
      return;
    }
    
    if (!scheduleMessages[0].messages || scheduleMessages[0].messages.length === 0) {
      console.error(`No messages found in schedule for ID: ${_id}`);
      return;
    }
    
    const message = scheduleMessages[0].messages[0];

    const messageObj = { sender: message.sender, receiver: message.receiver, _id, message_type: message.message_type };
    console.log(`Executing Message Delivery for ${_id}`);

    if (message.version !== version || message.status !== "pending") return;

  const user = await whatsappRepository.findUser({ mobile_number: message.sender });
  if (!user) {
    notifyDeliveryStatus("MESSAGE DELIVERY FAILED - USER NOT FOUND", "", messageObj);
    await whatsappRepository.updateMessage(_id, { status: "failed" });
    return;
  }
  const instance_id = user.instance_id;

  // 🚀 OPTIMIZATION: Try to get auth token from cache first
  let authToken = instanceCache.getAuthToken(instance_id);
  
  if (!authToken) {
    logger.warn(`No cached auth token for ${instance_id}, falling back to API polling`);
    const instance = await whatsappWrapper(whatsappHelper.fetchInstance(instance_id));
    console.log(`Instance during schedule: ${JSON.stringify(instance[0])}`);

    if (instance.length === 0) {
      notifyDeliveryStatus("MESSAGE DELIVERY FAILED - INSTANCE NOT FOUND", instance_id, messageObj);
      await whatsappRepository.updateMessage(_id, { status: "failed" });
      return;
    }

    authToken = instance[0].Auth.token;
    // Cache the result for future use
    instanceCache.cacheFromAPI(instance[0]);
  } else {
    logger.info(`Using cached auth token for scheduled message delivery: ${instance_id}`);
  }

  if (!authToken) {
    notifyDeliveryStatus("MESSAGE DELIVERY FAILED - AUTH TOKEN NOT AVAILABLE", instance_id, messageObj);
    await whatsappRepository.updateMessage(_id, { status: "failed" });
    return;
  }

  notifyDeliveryStatus("DELIVERING", instance_id, messageObj);
  let response: any;
  
  // Clean the message by removing GroupID marker before delivery
  const cleanMessage = message.message.replace(/\s*\[GroupID:[^\]]+\]$/, '');
  
  const messageBody = {
    instance_id,
    token: authToken,
    message: cleanMessage, // Send clean message to user
    receiver: message.receiver,
    id: _id,
    attr: `${message.sender}::${message._id}`,
  };

  if (!message.media) {
    log(`Executing sendText for ${_id}`);
    response = await whatsappsend(whatsappHelper.sendText(messageBody));
  } else {
    log(`Executing sendMedia for ${_id}`);
    response = await whatsappsend(
      whatsappHelper.sendMedia(
        Object.assign(messageBody, {
          media_type: message.media_type,
          media: message.media,
          file_name: message.file_name,
        }),
      ),
    );
  }

  if (response.status === 200 || response.status === 201) {
    await whatsappRepository.updateMessage(_id, { status: "success" });
    notifyDeliveryStatus("MESSAGE DELIVERY SUCCESS", instance_id, messageObj, JSON.stringify(response.data));
  } else {
    await whatsappRepository.updateMessage(_id, { status: "failed" });
    notifyDeliveryStatus("MESSAGE DELIVERY FAILED", instance_id, messageObj, JSON.stringify(response.data));
  }
  
  } catch (error) {
    console.error(`Error in deliverMessage for ID ${_id}:`, error);
    try {
      await whatsappRepository.updateMessage(_id, { status: "failed" });
    } catch (updateError) {
      console.error(`Failed to update message status for ID ${_id}:`, updateError);
    }
  }
}
