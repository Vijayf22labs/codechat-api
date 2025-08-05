import { ServiceResponse } from "@/common/models/serviceResponse";
import { logger } from "@/server";
import { StatusCodes } from "http-status-codes";
import type { Igroup } from "./groupInterface";
import { GroupRepository } from "./groupRepository";

export class GroupappService {
  private groupRepository: GroupRepository;

  constructor(repository: GroupRepository = new GroupRepository()) {
    this.groupRepository = repository;
  }

  async create(instance_id: string, group: Igroup): Promise<ServiceResponse<{ status: boolean } | null>> {
    try {
      const response = await this.groupRepository.create(instance_id, group);

      if (!response) return ServiceResponse.failure("UnAuthorized", null, StatusCodes.UNAUTHORIZED);
      if (response.status) return ServiceResponse.success<{ status: boolean }>("group added successfully!!", response);
      return ServiceResponse.failure<{ status: boolean }>(`${group.group_id} already assigned a message`, response);
    } catch (e) {
      const errorMessage = `Error in groups create function:, ${(e as Error).message}`;
      logger.error(errorMessage);
      return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async get(
    group_id: string,
    instance_id: string,
  ): Promise<ServiceResponse<{ status: boolean; message: string } | null>> {
    try {
      const group = await this.groupRepository.get(instance_id, group_id);

      if (!group) return ServiceResponse.failure("User doesn't have group with given groupId ", group, 404);
      return ServiceResponse.success<any>("groups retrieved", group);
    } catch (e) {
      const errorMessage = `Error in groups get function:, ${(e as Error).message}`;
      logger.error(errorMessage);
      return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async delete(group_id: string, instance_id: string): Promise<ServiceResponse<{ status: boolean } | null>> {
    try {
      const response = await this.groupRepository.delete(instance_id, group_id);

      if (!response) return ServiceResponse.failure("UnAuthorized", null, StatusCodes.UNAUTHORIZED);
      if (!response.status) return ServiceResponse.failure<any>("group is not found", response);
      return ServiceResponse.success<any>("group message deleted successfully", response);
    } catch (e) {
      const errorMessage = `Error in group delete function:, ${(e as Error).message}`;
      logger.error(errorMessage);
      return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async put(instance_id: string, iGroup: Igroup): Promise<ServiceResponse<{ status: boolean } | null>> {
    try {
      const response = await this.groupRepository.update(instance_id, iGroup);

      if (!response) return ServiceResponse.failure("UnAuthorized", null, StatusCodes.UNAUTHORIZED);
      if (!response.status) return ServiceResponse.failure("updation failure", null);
      return ServiceResponse.success<any>("updated successfully!!", response);
    } catch (e) {
      const errorMessage = `Error in group update function:, ${(e as Error).message}`;
      logger.error(errorMessage);
      return ServiceResponse.failure("Internal Server Error", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
}

export const groupServiceInstance = new GroupappService();
