import { EventEmitter } from "eventemitter3";

class EventBus extends EventEmitter {}

export const eventBus = new EventBus();

export const EVENT_INSTANCE_INIT = "EVENT_INSTANCE_INIT";
export const EVENT_INSTANCE_CONNECTED = "EVENT_INSTANCE_CONNECTED";
export const EVENT_INSTANCE_REMOVED = "EVENT_INSTANCE_REMOVED";

export function eventConstructor(event: string, payload: any): any {
  return { event: event, payload: payload };
}
