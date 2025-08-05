import { env } from "@/common/utils/envConfig";
import { logger } from "@/server";
import axios from "axios";

export class WhatsappHelper {
  private globalHeader = {
    "Content-Type": "application/json",
    Apikey: env.APIKEY,
  };

  private userSpecificHeader = (secretToken: string) => {
    return {
      Authorization: `Bearer ${secretToken}`,
      "Content-Type": "application/json",
    };
  };

  async fetchInstance(instanceName?: string) {
    try {
      let url = `${env.CODECHAT_API}/instance/fetchInstances`;
      url = instanceName ? `${url}?instanceName=${instanceName}` : url;
      const headers = this.globalHeader;
      const response = await axios.get(url, { headers });
      return response;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        return error.response;
      }
      throw error;
    }
  }

  async deleteInstance(instanceName: string, secretToken: string) {
    try {
      logger.info(`Delete Instance for ${instanceName}`);
      const url = `${env.CODECHAT_API}/instance/delete/${instanceName}?force=true`;
      const headers = this.userSpecificHeader(secretToken);
      const response = await axios.delete(url, { headers });
      logger.info(`Deleted Instance for ${instanceName}`);
      return response;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        return error.response;
      }
      throw error;
    }
  }

  async createInstance(instanceName: string, description?: string) {
    try {
      const url = `${env.CODECHAT_API}/instance/create`;
      const data = { instanceName, description };
      const headers = this.globalHeader;
      const response = await axios.post(url, data, { headers });
      logger.info(`Created instance ${instanceName}`);
      return response;
    } catch (error: any) {
      logger.error(`createInstance failed for ${instanceName}:`, error);
      throw error;
    }
  }

  async connectInstance(instanceName: string, secretToken: string) {
    const url = `${env.CODECHAT_API}/instance/connect/${instanceName}`;
    const headers = this.userSpecificHeader(secretToken);
    const response = await axios.get(url, { headers });
    return response;
  }

  async sendText(messageObj: any) {
    const url = `${env.CODECHAT_API}/message/sendText/${messageObj.instance_id}`;
    const data = {
      number: messageObj.receiver,
      options: {
        delay: 1000,
        presence: "composing",
        messageId: messageObj.id,
        externalAttributes: messageObj.attr,
      },
      textMessage: {
        text: messageObj.message,
      },
    };
    const headers = this.userSpecificHeader(messageObj.token);
    const response = await axios.post(url, data, { headers });
    return response;
  }

  async sendMedia(messageObj: any) {
    const url = `${env.CODECHAT_API}/message/sendMedia/${messageObj.instance_id}`;
    const data = {
      number: messageObj.receiver,
      options: {
        delay: 1000,
        presence: "composing",
        messageId: messageObj.id,
        externalAttributes: messageObj.attr,
      },
      mediaMessage: {
        mediatype: messageObj.media_type,
        fileName: messageObj.file_name,
        caption: messageObj.message,
        media: messageObj.media,
      },
    };
    const headers = this.userSpecificHeader(messageObj.token);
    const response = axios.post(url, data, { headers });
    return response;
  }

  async registerWebhook(instanceName: string, secretToken: string) {
    logger.info(`Register webhook for ${instanceName}`);
    const url = `${env.CODECHAT_API}/webhook/set/${instanceName}`;
    const data = {
      enabled: true,
      url: `${env.WEBHOOK_URL}`,
      events: {
        qrcodeUpdated: false,
        messagesSet: false,
        messagesUpsert: false,
        messagesUpdated: false,
        sendMessage: true,
        contactsSet: false,
        contactsUpsert: false,
        contactsUpdated: false,
        chatsSet: false,
        chatsUpsert: false,
        chatsUpdated: false,
        chatsDeleted: false,
        presenceUpdated: false,
        groupsUpsert: true,
        groupsUpdated: true,
        groupsParticipantsUpdated: true,
        connectionUpdated: true,
        statusInstance: true,
        refreshToken: true,
      },
    };
    const headers = this.userSpecificHeader(secretToken);
    const response = await axios.put(url, data, { headers });
    logger.info(`Registered webhook for ${instanceName}`);
    return response;
  }

  async unRegisterWebhook(instanceName: string, secretToken: string) {
    logger.info(`Unregister webhook for ${instanceName}`);
    const url = `${env.CODECHAT_API}/webhook/set/${instanceName}`;
    const data = {
      enabled: false,
      url: `${env.WEBHOOK_URL}`,
      events: {
        qrcodeUpdated: false,
        messagesSet: false,
        messagesUpsert: false,
        messagesUpdated: false,
        sendMessage: true,
        contactsSet: false,
        contactsUpsert: false,
        contactsUpdated: false,
        chatsSet: false,
        chatsUpsert: false,
        chatsUpdated: false,
        chatsDeleted: false,
        presenceUpdated: false,
        groupsUpsert: false,
        groupsUpdated: false,
        groupsParticipantsUpdated: false,
        connectionUpdated: false,
        statusInstance: false,
        refreshToken: false,
      },
    };
    const headers = this.userSpecificHeader(secretToken);
    const response = await axios.put(url, data, { headers });
    logger.info(`Unregistered webhook for ${instanceName}`);
    return response;
  }
}
