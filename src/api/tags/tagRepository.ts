import { logger } from "@/server";
import { User } from "../whatsapp/whatsappRepository";
import type { Imember, TagsArray } from "./tagInterface";
export class TagRepository {
  async createOrUpdate(tags: any, user_name: string, mobile_number: string, instance_id: string, addedAt: Date) {
    const user = await User.findOne({ instance_id });
    if (!user) {
      console.error("User not found");
      return null;
    }
    for (const tag of tags) {
      // Check if the tag exists
      const existingTag = await User.findOne({
        _id: user._id,
        "tag.name": tag,
      });

      if (!existingTag) {
        // Tag doesn't exist, create a new one
        await User.findOneAndUpdate(
          { _id: user._id },
          { $push: { tag: { name: tag, members: [] } } },
          { upsert: true },
        );
      }
      await User.findOneAndUpdate(
        {
          _id: user._id,
          "tag.name": tag,
        },
        {
          $addToSet: {
            "tag.$.members": {
              user_name: user_name,
              mobile_number: mobile_number.replace("@c.us", ""),
              addedAt: addedAt,
            },
          },
        },
        { new: true },
      );
    }
    return { status: true };
  }

  async get(tag_name: string, mobile_number: string, instance_id: string) {
    const user = await User.findOne({ instance_id });
    if (!user || user?.tag?.length === 0) return [];

    let tags = user.tag;
    if (tag_name) {
      tags = tags?.filter((tag) => tag.name === tag_name);
    }
    if (mobile_number) {
      tags = tags?.filter((tag) => {
        return tag.members.some((member) => member.mobile_number === this.formatMobile(mobile_number));
      });
      return tags?.map((tag) => tag.name);
    }
    const result = !mobile_number
      ? tags?.map((item) => ({
          name: item?.name || "",
          members: item?.members || [],
          memberCount: item?.members?.length || 0,
        })) || []
      : tags;

    return result;
  }

  formatMobile(mobile_number: string): string {
    return mobile_number.replace("@c.us", "");
  }

  async delete(tag_name: string, mobile_number: string, instance_id: string) {
    const user = await User.findOne({ instance_id });
    if (!user) return { message: "user not found", status: false };
    const tag = user?.tag?.find((tag) => tag.name === tag_name);
    if (!tag) return { message: " tag not found", status: false };

    if (!mobile_number) {
      await User.findOneAndUpdate({ _id: user._id, "tag.name": tag_name }, { $pull: { tag: { name: tag_name } } });
      return { message: `Tag '${tag_name}' deleted successfully`, status: true };
    }

    const formattedMobile = this.formatMobile(mobile_number);
    const phoneNumbers = tag.members.some((member) => member.mobile_number === formattedMobile);
    if (!phoneNumbers) {
      return { message: `mobile_number '${mobile_number}' not found in Tag '${tag_name}'`, status: false };
    }
    await User.findOneAndUpdate(
      { _id: user._id, "tag.name": tag_name },
      { $pull: { "tag.$.members": { mobile_number: formattedMobile } } },
    );
    return { message: `mobile_number '${mobile_number}' deleted from Tag '${tag_name}' successfully`, status: true };
  }

  async commonMembertags(tags: string[], mobile_number: string) {
    const user = await User.findOne({ mobile_number });
    if (!user) return { message: "Invalid User", status: false };

    const filteredTags: TagsArray = user.tag ? user.tag.filter((tag) => tags.includes(tag.name)) : [];
    if (!filteredTags || filteredTags.length === 0) return { members: [] };

    const membersByMobile = filteredTags?.map((tag) => tag.members.map((member) => member.mobile_number)) ?? [];

    const commonMobileNumbers = membersByMobile.reduce((acc, mobiles) =>
      acc.filter((mobile) => mobiles.includes(mobile)),
    );

    const intersectedMembers = filteredTags
      .flatMap((tag) => tag.members)
      .filter((member) => commonMobileNumbers.includes(member.mobile_number))
      .map((member) => ({
        user_name: member.user_name,
        mobile_number: member.mobile_number,
        addedAt: member.addedAt || null,
      }));

    const uniqueMembers = intersectedMembers.reduce((acc, current) => {
      if (!acc.some((member) => member.mobile_number === current.mobile_number)) {
        acc.push(current);
      }
      return acc;
    }, [] as Imember[]);

    const sortedMembers = uniqueMembers.sort((a, b) => a.user_name.localeCompare(b.user_name));
    return { commonMembers: sortedMembers };
  }
}
