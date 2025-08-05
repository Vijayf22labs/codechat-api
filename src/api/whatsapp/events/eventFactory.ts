import { EVENT_INSTANCE_CONNECTED, EVENT_INSTANCE_INIT, EVENT_INSTANCE_REMOVED } from "./eventBus";
import type { BaseEvent } from "./events/baseEvent";
import { InstanceConnectedEvent } from "./events/instanceConnectedEvent";
import { InstanceInitEvent } from "./events/instanceInitEvent";
import { InstanceRemovedEvent } from "./events/instanceRemovedEvent";

class EventFactory {
  private static instance: EventFactory;

  private constructor() {}

  public static getInstance(): EventFactory {
    if (!EventFactory.instance) {
      EventFactory.instance = new EventFactory();
    }
    return EventFactory.instance;
  }

  public getHandler(event: string): BaseEvent {
    switch (event) {
      case EVENT_INSTANCE_INIT:
        return new InstanceInitEvent();
      case EVENT_INSTANCE_CONNECTED:
        return new InstanceConnectedEvent();
      case EVENT_INSTANCE_REMOVED:
        return new InstanceRemovedEvent();
      default:
        throw new Error(`Unknown event type: ${event}`);
    }
  }
}

export default EventFactory;
