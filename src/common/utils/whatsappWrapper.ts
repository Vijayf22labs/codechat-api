import { logger } from "@/server";
import type { AxiosError } from "axios";
import { notifySlack } from "./slack";

interface AxiosErrorResponseData {
  message: string[];
}
export const whatsappWrapper = async (instanceCall: Promise<any | []>) => {
  try {
    const response = await instanceCall;
    return response.data;
  } catch (e) {
    if (
      (e as AxiosError)?.response?.status === 400 &&
      ((e as AxiosError).response?.data as AxiosErrorResponseData)?.message[0] === "Instance not found"
    ) {
      logger.warn(`Received 400 error: ${(e as Error).message}`);
      return [];
    } else {
      const errorMessage = `Error in instance call: ${(e as Error).message}`;
      logger.error(errorMessage);
      throw e;
    }
  }
};

export const whatsappWrapperNew = async (instanceCall: Promise<any | []>) => {
  try {
    const response = await instanceCall;
    return response;
  } catch (e) {
    return (e as AxiosError)?.response;
  }
};

export const whatsappsend = async (instanceCall: Promise<any | []>) => {
  try {
    const response = await instanceCall;
    return response;
  } catch (e) {
    logger.error(`whatsappsend function error ${e}`);
    return (e as AxiosError)?.response;
  }
};
