import { eventBus } from "./eventBus";
import EventBusFactory from "./eventFactory";
import { logger } from "@/server";

eventBus.on("whatsapp_event", (data) => {
  logger.info(`Event ${data.event} Received with ${JSON.stringify(data.payload)}`);
  EventBusFactory.getInstance().getHandler(data.event)?.process(data.payload);
});
