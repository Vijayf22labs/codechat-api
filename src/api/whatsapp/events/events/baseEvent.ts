import { whatsappWrapperNew } from "@/common/utils/whatsappWrapper";
import { WhatsappHelper } from "../../../../common/utils/whatsappHelper";
import { WhatsappRepository } from "../../../whatsapp/whatsappRepository";

export abstract class BaseEvent {
  protected whatsappHelper: WhatsappHelper;
  protected whatsappRepository: WhatsappRepository;

  constructor(
    whatsappHelper: WhatsappHelper = new WhatsappHelper(),
    whatsappRepository: WhatsappRepository = new WhatsappRepository(),
  ) {
    this.whatsappHelper = whatsappHelper;
    this.whatsappRepository = whatsappRepository;
  }
  abstract process(data: any): void;
}
