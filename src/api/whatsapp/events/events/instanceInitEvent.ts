import { BaseEvent } from "./baseEvent";

export class InstanceInitEvent extends BaseEvent {
  // EVENT_INSTANCE_INIT
  process(data: any) {
    this.whatsappRepository.updateInstances(data.instance_name, { initiated_at: new Date() });
  }
}
