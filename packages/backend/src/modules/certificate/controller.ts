import { AppInstance } from "@/types";
import {
  SchemaCertificateAddBody,
  SchemaCertificateAddResponse,
  SchemaCertificateDetailBody,
  SchemaCertificateDetailResponse,
  SchemaCertificateUpdateBody,
  SchemaCertificateDeleteBody,
  SchemaCertificateMoveBody,
  SchemaCertificateSortBody,
  SchemaCertificateSearchBody,
  SchemaCertificateSearchResponse,
} from "@/types/certificate";
import { CertificateService } from "./service";

interface RegisterOptions {
  server: AppInstance;
  certificateService: CertificateService;
}

export const registerCertificateController = (options: RegisterOptions) => {
  const { server, certificateService } = options;

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
    "/certificate/search",
    {
      schema: {
        description: "搜索凭证",
        tags: ["certificate"],
        body: SchemaCertificateSearchBody,
        response: { 200: SchemaCertificateSearchResponse },
      },
    },
    async (request) => {
      return await certificateService.search(request.body);
    },
  );
};
