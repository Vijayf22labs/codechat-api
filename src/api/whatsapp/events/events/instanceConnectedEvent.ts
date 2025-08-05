import { InstanceConstants } from "@/constants/instanceConstants";
import { BaseEvent } from "./baseEvent";
import { WhatsappRepository } from "../../whatsappRepository";

export class InstanceConnectedEvent extends BaseEvent {
  whatsappRepository: WhatsappRepository = new WhatsappRepository();

  // EVENT_INSTANCE_CONNECTED
  async process(payload: any) {
    console.log("processing event EVENT_INSTANCE_CONNECTED");
    await this.whatsappRepository.createOrUpdateInstance(payload.instance_name, {
      initiated_at: undefined,
      status: InstanceConstants.ONLINE,
    });

    const existingUser = await this.whatsappRepository.findUser({
      mobile_number: payload.mobile_number,
    });

    const updateData = {
      instance_id: payload.instance_name,
      status: InstanceConstants.ONLINE,
    };

    if (existingUser && !existingUser.otp) {
      Object.assign(updateData, { otp: this.createOtp() });
    }

    await this.whatsappRepository.createOrUpdateUser(payload.mobile_number, updateData);
  }

  createOtp() : string {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    // while (true) {
    //   console.log(otp)
    //   otp = Math.floor(1000 + Math.random() * 9000).toString()
    //   let user = this.whatsappRepository.findUserByOtp(otp)
    //   if (!user) return otp
    // }
    return otp;
  }
}
