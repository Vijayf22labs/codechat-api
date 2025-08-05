import { ServiceResponse } from "@/common/models/serviceResponse";
import { logger } from "@/server";
import { StatusCodes } from "http-status-codes";
import type { TagsArray } from "./tagInterface";
import type { IcommonMemberRes } from "./tagModel";
import { TagRepository } from "./tagRepository";
export class TagsappService {
  private tagRepository: TagRepository;

  constructor(repository: TagRepository = new TagRepository()) {
    this.tagRepository = repository;
  }

  async createOrUpdate(
    tags: string,
    userName: string,
    mobile_number: string,
    instance_id: string,
    addedAt: Date,
  ): Promise<ServiceResponse<{ status: boolean } | null>> {
    try {
      const response = await this.tagRepository.createOrUpdate(tags, userName, mobile_number, instance_id, addedAt);
      if (!response) return ServiceResponse.failure("UnAuthorized", null, StatusCodes.UNAUTHORIZED);
      return ServiceResponse.success<{ status: boolean }>("tags created successfully!!", response);
    } catch (e) {
      const errorMessage = `Error in tags create function:, ${(e as Error).message}`;
      logger.error(errorMessage);
      return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async get(
    tag: string,
    mobile_number: string,
    instance_id: string,
  ): Promise<ServiceResponse<TagsArray | string[] | null>> {
    try {
      const response = await this.tagRepository.get(tag, mobile_number, instance_id);

      if (!response) return ServiceResponse.failure("UnAuthorized", null, StatusCodes.UNAUTHORIZED);
      return ServiceResponse.success<any>("tags retrieved", response);
    } catch (e) {
      const errorMessage = `Error in tags get function:, ${(e as Error).message}`;
      logger.error(errorMessage);
      return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async delete(tag: string, mobile_number: string, instance_id: string): Promise<ServiceResponse<null>> {
    try {
      const response = await this.tagRepository.delete(tag, mobile_number, instance_id);
      if (response.status === false) return ServiceResponse.failure(response.message, null, StatusCodes.NOT_FOUND);
      return ServiceResponse.success<null>(response.message, null);
    } catch (e) {
      const errorMessage = `Error in tags delete function:, ${(e as Error).message}`;
      logger.error(errorMessage);
      return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async getCommonMemberTags(tags: string[], mobile_number: string): Promise<ServiceResponse<IcommonMemberRes | null>> {
    const response = await this.tagRepository.commonMembertags(tags, mobile_number);
    if (response.status === false) return ServiceResponse.failure(response.message, null, StatusCodes.NOT_FOUND);
    return ServiceResponse.success<any>("Members retrieved successfully!!", response);
  }
}

export const tagsServiceInstance = new TagsappService();
