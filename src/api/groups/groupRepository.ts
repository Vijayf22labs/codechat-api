import { userReqBody } from "../whatsapp/whatsappModel";
import { User } from "../whatsapp/whatsappRepository";
import type { Igroup } from "./groupInterface";
export class GroupRepository {
  async create(instance_id: string, i_group: Igroup) {
    let user = await User.findOne({ instance_id });
    if (!user) {
      console.error("User not found");
      return null;
    }
    user = user.toJSON();
    if (!user.groups) {
      await User.findOneAndUpdate({ _id: user._id }, { $push: { groups: [] } }, { new: true });
    }
    if (user.groups?.find((group) => group.group_id.toString() === i_group.group_id.toString()))
      return { status: false };

    await User.findOneAndUpdate(
      { _id: user._id },
      {
        $push: {
          groups: {
            group_id: i_group.group_id,
            message: i_group.message,
            delay: i_group.delay,
            status: i_group.status,
          },
        },
      },
      { new: true },
    );
    return { status: true };
  }

  async get(instance_id: string, group_id: string) {
    const group = await this.findUserAndGroup(instance_id, group_id);
    if (!group) return null;
    return { message: group.message, delay: group.delay, status: group.status };
  }

  async delete(instance_id: string, group_id: string) {
    const group = await this.findUserAndGroup(instance_id, group_id);
    if (!group) return { status: false, message: null };
    const result = await User.findOneAndUpdate({ instance_id }, { $pull: { groups: { group_id } } }, { new: true });
    return result ? { status: true } : { status: false };
  }

  async update(instance_id: string, iGroup: Igroup) {
    const group = await this.findUserAndGroup(instance_id, iGroup.group_id);
    if (!group) return { status: false, message: null };

    const result = await User.findOneAndUpdate(
      { instance_id, "groups.group_id": iGroup.group_id },
      {
        $set: { "groups.$.message": iGroup.message, "groups.$.delay": iGroup.delay, "groups.$.status": iGroup.status },
      },
      { new: true },
    );
    return result ? { status: true } : { status: false };
  }

  async findUserAndGroup(instance_id: string, group_id: string): Promise<Igroup | null> {
    let user = await User.findOne({ instance_id });
    if (!user) {
      console.error("User not found");
      return null;
    }
    user = user.toJSON();
    console.log(`group_id : ${group_id}`);
    console.log(`User groups : ${JSON.stringify(user.groups)}`);
    const group = user.groups?.find((group) => group.group_id.toString() === group_id.toString());
    console.log(`User group : ${JSON.stringify(group)}`);
    if (!group) return null;

    // Ensure the returned object matches Igroup interface
    return {
      group_id: group.group_id,
      message: group.message,
      delay: group.delay || 1,
      status: group.status || "active", // Provide a default status if not present
    };
  }
}
