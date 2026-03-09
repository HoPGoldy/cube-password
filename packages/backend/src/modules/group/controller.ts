import { AppInstance } from "@/types";
import {
  SchemaGroupAddBody,
  SchemaGroupAddResponse,
  SchemaGroupListResponse,
  SchemaGroupUpdateNameBody,
  SchemaGroupUpdateConfigBody,
  SchemaGroupUnlockBody,
  SchemaGroupDeleteBody,
  SchemaGroupSortBody,
  SchemaGroupSetDefaultBody,
} from "@/types/group";
import { GroupService } from "./service";

interface RegisterOptions {
  server: AppInstance;
  groupService: GroupService;
}

export const registerGroupController = (options: RegisterOptions) => {
  const { server, groupService } = options;

  server.post(
    "/group/add",
    {
      schema: {
        description: "创建分组",
        tags: ["group"],
        body: SchemaGroupAddBody,
        response: { 200: SchemaGroupAddResponse },
      },
    },
    async (request) => {
      return await groupService.addGroup(request.body);
    },
  );

  server.post(
    "/group/list",
    {
      schema: {
        description: "分组列表",
        tags: ["group"],
        response: { 200: SchemaGroupListResponse },
      },
    },
    async () => {
      return await groupService.listGroups();
    },
  );

  server.post(
    "/group/update-name",
    {
      schema: {
        description: "重命名分组",
        tags: ["group"],
        body: SchemaGroupUpdateNameBody,
      },
    },
    async (request) => {
      const { id, name } = request.body;
      await groupService.updateName(id, name);
      return {};
    },
  );

  server.post(
    "/group/update-config",
    {
      schema: {
        description: "更新分组锁定配置",
        tags: ["group"],
        body: SchemaGroupUpdateConfigBody,
      },
    },
    async (request) => {
      const { id, lockType, passwordHash, passwordSalt } = request.body;
      await groupService.updateConfig(id, lockType, passwordHash, passwordSalt);
      return {};
    },
  );

  server.post(
    "/group/unlock",
    {
      schema: {
        description: "解锁分组",
        tags: ["group"],
        body: SchemaGroupUnlockBody,
      },
    },
    async (request) => {
      const { id, hash, challengeCode, totpCode } = request.body;
      await groupService.unlock(id, { hash, challengeCode, totpCode });
      return {};
    },
  );

  server.post(
    "/group/delete",
    {
      schema: {
        description: "删除分组",
        tags: ["group"],
        body: SchemaGroupDeleteBody,
      },
    },
    async (request) => {
      await groupService.deleteGroup(request.body.id);
      return {};
    },
  );

  server.post(
    "/group/sort",
    {
      schema: {
        description: "更新排序",
        tags: ["group"],
        body: SchemaGroupSortBody,
      },
    },
    async (request) => {
      await groupService.sort(request.body.ids);
      return {};
    },
  );

  server.post(
    "/group/set-default",
    {
      schema: {
        description: "设置默认分组",
        tags: ["group"],
        body: SchemaGroupSetDefaultBody,
      },
    },
    async (request) => {
      await groupService.setDefault(request.body.id);
      return {};
    },
  );
};
