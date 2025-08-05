import type { Iuser } from "@/api/whatsapp/whatsappInterface";
import { User, WhatsappRepository } from "@/api/whatsapp/whatsappRepository";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { whatsappWrapper } from "@/common/utils/whatsappWrapper";
import { InstanceCache } from "@/common/utils/instanceCache";
import { logger } from "@/server";
import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { WhatsappHelper } from "../utils/whatsappHelper";
import { log } from "../utils/logger";
import { InstanceConstants } from "@/constants/instanceConstants";

export const verifyWhatsappInstance = async (req: Request, res: Response, next: NextFunction) => {
  let serviceResponse = null;
  const instanceName = req.headers.id as string;
  const instanceCache = InstanceCache.getInstance();
  
  try {
    //OPTIMIZATION: Try to get instance from cache first
    const mockInstanceArray = instanceCache.createMockInstanceArray(instanceName);
    
    if (mockInstanceArray) {
      logger.info(`Using cached instance data for middleware: ${instanceName}`);
      req.body.instance = mockInstanceArray;
      next();
      return;
    }
    
    // Fallback: poll API if not in cache
    logger.warn(`No cached instance data for ${instanceName}, falling back to API polling`);
    
    //PERFORMANCE TESTING: Start timing the API polling
    const pollingStartTime = Date.now();
    logger.info(`..............POLLING START: Initiating fetchInstance API call for ${instanceName} at ${new Date().toISOString()}`);

    const whatappHelper = new WhatsappHelper();
    const instance = await whatsappWrapper(whatappHelper.fetchInstance(instanceName));
    
    // PERFORMANCE TESTING: Calculate and log polling duration
    const pollingEndTime = Date.now();
    const pollingDuration = pollingEndTime - pollingStartTime;
    logger.info(`..............POLLING COMPLETE: fetchInstance API call took ${pollingDuration}ms for ${instanceName}..............`);
    logger.info(`..............POLLING STATS: Started at ${new Date(pollingStartTime).toISOString()}, ended at ${new Date(pollingEndTime).toISOString()}..............`);

    if (pollingDuration > 1000) {
      logger.warn(`..............SLOW POLLING DETECTED: ${instanceName} took ${pollingDuration}ms (${(pollingDuration/1000).toFixed(2)}s)..............`);
    }
    
    if (instance.length > 0) {
      // Cache the result for future use
      instanceCache.cacheFromAPI(instance[0]);
      logger.info(`......................Instance ${instanceName} found and cached successfully.`);
      req.body.instance = instance;
      next();
    } else {
      logger.error(`......................Instance ${instanceName} not found in API response.`);
      const whatsappRepository = new WhatsappRepository();
      try {
        const dbInstance = await whatsappRepository.findInstance(instanceName);
        if (dbInstance?.status === InstanceConstants.ONLINE) {
          logger.warn(`.........Database migration mismatch detected: MongoDB ONLINE but PostgreSQL empty for ${instanceName}`);
          
          // Clear cache and reset MongoDB status to OFFLINE
          instanceCache.clearInstanceCache(instanceName);
          await whatsappRepository.userLogout(instanceName);
          
          logger.info(`.................Reset ${instanceName} status due to database migration - forcing reconnection`);
          serviceResponse = ServiceResponse.failure(
            "INSTANCE_DISCONNECTED",
            null,
            StatusCodes.GONE,
          );
        } else {
          // Standard 404 handling
          serviceResponse = ServiceResponse.failure(
            `Whatsapp Instance ${instanceName} not found`,
            null,
            StatusCodes.NOT_FOUND,
          );
        }
      }
      catch (dbError) {
        logger.error(`................Error fetching instance from database for ${instanceName}:`, dbError);
        serviceResponse = ServiceResponse.failure(
          `Whatsapp Instance ${instanceName} not found in database`,
          null,
          StatusCodes.NOT_FOUND,
        );
      }
    }
  }
   catch (e) {
    //Before Migration Fix
    // serviceResponse = ServiceResponse.failure(
    //     `Whatsapp Instance ${instanceName} not found`,
    //     null,
    //     StatusCodes.NOT_FOUND,
    //   );
    //
    logger.error(`................Error fetching Whatsapp instance ${instanceName}:`, e);
    serviceResponse = ServiceResponse.failure(
      `Whatsapp Instance ${instanceName} not found`,
      null,
      StatusCodes.NOT_FOUND,
    );
  }
  if (serviceResponse) return res.status(serviceResponse.statusCode).send(serviceResponse);
};

export interface CustomRequest extends Request {
  user?: Iuser;
}
export const verifyUserInstance = async (req: CustomRequest, res: Response, next: NextFunction) => {
  log(`Incoming·header·:·${req.headers.id}`);
  const instanceName = req.headers.id;
  const user = await User.findOne({ instance_id: req.headers.id });
  if (!user)
    return res
      .status(StatusCodes.NOT_FOUND)
      .send(ServiceResponse.failure(`User Instance ${instanceName} not found`, null, StatusCodes.NOT_FOUND));
  req.body.user = user;
  req.query.sender = user.mobile_number; // Convert ObjectId to string
  req.body.sender = user.mobile_number;
  next();
};

export const verifyInstance = async (req: Request, res: Response, next: NextFunction) => {
  await verifyWhatsappInstance(req, res, async () => {
    await verifyUserInstance(req, res, next);
  });
};
