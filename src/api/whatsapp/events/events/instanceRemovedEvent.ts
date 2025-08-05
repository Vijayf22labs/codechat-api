import { InstanceConstants } from "@/constants/instanceConstants";
import { BaseEvent } from "./baseEvent";

export class InstanceRemovedEvent extends BaseEvent {
  // EVENT_INSTANCE_REMOVED
  process(data: any) {
    this.whatsappRepository.updateInstances(data.instance_name, { status: InstanceConstants.OFFLINE });
    this.whatsappRepository.updateUserWithInstance(data.instance_name, { status: InstanceConstants.OFFLINE });
  }
}
