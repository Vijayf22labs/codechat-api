import { bool } from "aws-sdk/clients/signer";
import type { Types } from "mongoose";

export interface IscheduleMessageReq {
  id?: string;
  receiver_name?: string;
  message?: string;
  message_type?: string;
  sender: string;
  receiver: string;
  scheduled_at: string;
  instanceName?: string;
  mediaType?: string;
  fileName?: string;
  media_type?: string;
  file_name?: string;
  file?: File;
  media?: string;
  _id?: string;
}

export interface IMessage {
  id?: string;
  receiver_name?: string;
  message?: string;
  message_type?: string;
  sender: string;
  receiver: string;
  scheduled_at: string;
  instanceName?: string;
  mediaType?: string;
  media_status?: string;
  fileName?: string;
  media_type?: string;
  file_name?: string;
  file?: File;
  media?: string;
  _id?: string;
}

export interface IscheduleMessageRes {
  message: string;
  version: number;
  receiver: string;
  scheduled_at: Date;
  token?: string;
  id?: string;
  sender?: string;
  _id?: string;
}

export interface Iresponse {
  message: string;
  success: boolean;
}

export interface LoginQRVerifyResponse {
  instance: string;
}

export interface LoginQR {
  qr_code: string;
}

export interface IisConnected {
  is_connected: boolean;
}

export interface IuserStatus {
  status?: string;
  is_new_user?: boolean;
}

export interface IinstanceStatus {
  status?: string;
}

export interface IcreateUser {
  mobile_number?: string;
  instance_id?: string;
  invite_code?: string;
}

export interface IupdateUser {
  mobile_number?: string;
  instance_id?: string;
  invite_code?: string;
  otp?: string;
  is_new_user?: boolean;
  status?: string;
}

export interface IuserProfile {
  mobile_number: string;
  otp: string;
}

export interface ImessageObj {
  _id: string;
  message: string;
  version: number;
  receiver: string;
  scheduled_at: Date;
}

export interface IdeliverMessageObj {
  _id: string;
  version: number;
  status: string;
}

export interface IupdatemessageObj {
  id: string;
}

export interface Iinstance {
  id: number;
  name: string;
  description: string;
  connectionStatus: string;
  ownerJid: string;
  profilePicUrl: string;
  createdAt: Date;
  updatedAt: Date;
  Auth: {
    id: number;
    token: string;
    createdAt: Date;
    updatedAt: Date;
  };
  Webhook?: string;
  Typebot?: string;
}

export interface IgetScheduleFilter {
  status: string;
  sender: string;
  pageSize: number;
  skip: number;
  pageNo: number;
  receiver: string;
}

export interface MulterRequest extends Request {
  file: any;
}

export interface Iuser {
  mobile_number: string;
  status: string;
  instance_id: string;
  allowed_message_count: number;
  invite_code: string;
  otp: string;
  group_permission: boolean;
  referred_users_count: number;
  referred_by: Types.ObjectId;
  is_new_user: boolean;
  messages: Imessage[];
  groups: IGroup[];
  tag?: {
    name: string;
    members: {
      user_name: string;
      mobile_number: string;
      addedAt: Date;
    }[];
  }[];
}
export interface Imessage {
  _id?: string;
  receiver_name: string;
  message: string;
  message_type: string;
  sender: string;
  receiver: string;
  retry_count: number;
  version: number;
  scheduled_at: Date;
  status: string;
  whatsapp_acknowledgement_id: string;
  media_type: string;
  media: string;
  file_name: string;
}

export interface IGroup {
  _id?: string;
  group_id: string;
  message: string;
  delay: number;
  status: string;
}

export interface IMessageMeta {
  _id: string;
  sender: string;
  receiver: string;
  message_type: string;
}

export interface Iinstance {
  id: number;
  uuid: string;
  mobile_number: string;
  status: string;
}
// Define Instances interface
export interface Instance {
  uuid?: string;
  _id?: string | Types.ObjectId;
  mobile_number?: string;
  status?: string;
  initiated_at?: Date;
}
export interface Iinvitation {
  id: number;
  referral: Types.ObjectId;
  referee: Types.ObjectId;
  status: string;
}
