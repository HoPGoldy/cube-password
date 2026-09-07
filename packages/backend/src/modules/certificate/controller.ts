import { AppInstance } from "@/types";
import {
  SchemaCertificateListByGroupBody,
  SchemaCertificateListByGroupResponse,
  SchemaCertificateIndexResponse,
  SchemaCertificateAddBody,
  SchemaCertificateAddResponse,
  SchemaCertificateDetailBody,
  SchemaCertificateDetailResponse,
  SchemaCertificateUpdateBody,
  SchemaCertificateDeleteBody,
  SchemaCertificateMoveBody,
  SchemaCertificateSortBody,
  SchemaCertificateMigrateMetadataBody,
  SchemaCertificateMigrateMetadataResponse,
} from "@/types/certificate";
import { CertificateService } from "./service";

interface RegisterOptions {
  server: AppInstance;
  certificateService: CertificateService;
}

export const registerCertificateController = (options: RegisterOptions) => {
  const { server, certificateService } = options;

  server.post(
    "/certificate/list",
    {
      schema: {
        description: "按分组列出凭证",
        tags: ["certificate"],
        body: SchemaCertificateListByGroupBody,
        response: { 200: SchemaCertificateListByGroupResponse },
      },
    },
    async (request) => {
      return await certificateService.listByGroup(request.body.groupId);
    },
  );

  server.post(
    "/certificate/index",
    {
      schema: {
        description:
          "全量凭证索引（元数据加密）：仅索引字段，供前端解密 nameEnc 构建内存明文索引；限可达分组",
        tags: ["certificate"],
        response: { 200: SchemaCertificateIndexResponse },
      },
    },
    async () => {
      return await certificateService.listAll();
    },
  );

  server.post(
    "/certificate/add",
    {
      schema: {
        description: "创建凭证",
        tags: ["certificate"],
        body: SchemaCertificateAddBody,
        response: { 200: SchemaCertificateAddResponse },
      },
    },
    async (request) => {
      return await certificateService.add(request.body);
    },
  );

  server.post(
    "/certificate/detail",
    {
      schema: {
        description: "获取凭证详情",
        tags: ["certificate"],
        body: SchemaCertificateDetailBody,
        response: { 200: SchemaCertificateDetailResponse },
      },
    },
    async (request) => {
      return await certificateService.detail(request.body.id);
    },
  );

  server.post(
    "/certificate/update",
    {
      schema: {
        description: "更新凭证",
        tags: ["certificate"],
        body: SchemaCertificateUpdateBody,
      },
    },
    async (request) => {
      return await certificateService.update(request.body);
    },
  );

  server.post(
    "/certificate/delete",
    {
      schema: {
        description: "批量删除凭证",
        tags: ["certificate"],
        body: SchemaCertificateDeleteBody,
      },
    },
    async (request) => {
      await certificateService.delete(request.body.ids);
      return {};
    },
  );

  server.post(
    "/certificate/move",
    {
      schema: {
        description: "移动凭证到新分组",
        tags: ["certificate"],
        body: SchemaCertificateMoveBody,
      },
    },
    async (request) => {
      const { ids, newGroupId } = request.body;
      await certificateService.move(ids, newGroupId);
      return {};
    },
  );

  server.post(
    "/certificate/sort",
    {
      schema: {
        description: "更新凭证排序",
        tags: ["certificate"],
        body: SchemaCertificateSortBody,
      },
    },
    async (request) => {
      await certificateService.sort(request.body.ids);
      return {};
    },
  );

  server.post(
    "/certificate/migrate-metadata",
    {
      schema: {
        description:
          "迁移凭证名称为密文（单事务批量写 nameEnc；finish=true 时同事务收尾 metadataVersion=2）",
        tags: ["certificate"],
        body: SchemaCertificateMigrateMetadataBody,
        response: { 200: SchemaCertificateMigrateMetadataResponse },
      },
    },
    async (request) => {
      return await certificateService.migrateMetadata(request.body);
    },
  );
};
