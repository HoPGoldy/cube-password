import { AppInstance } from "@/types";
import {
  SchemaCertificateListByGroupBody,
  SchemaCertificateListByGroupResponse,
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

/** 常见英文名词表，用于随机用户名生成 */
const FIRST_NAMES = [
  "James",
  "Mary",
  "Robert",
  "Patricia",
  "John",
  "Jennifer",
  "Michael",
  "Linda",
  "David",
  "Elizabeth",
  "William",
  "Barbara",
  "Richard",
  "Susan",
  "Joseph",
  "Jessica",
  "Thomas",
  "Sarah",
  "Christopher",
  "Karen",
  "Charles",
  "Lisa",
  "Daniel",
  "Nancy",
  "Matthew",
  "Betty",
  "Anthony",
  "Margaret",
  "Mark",
  "Sandra",
  "Donald",
  "Ashley",
  "Steven",
  "Kimberly",
  "Paul",
  "Emily",
  "Andrew",
  "Donna",
  "Joshua",
  "Michelle",
  "Kenneth",
  "Carol",
  "Kevin",
  "Amanda",
  "Brian",
  "Dorothy",
  "George",
  "Melissa",
  "Timothy",
  "Deborah",
];

/** 常见英文名词表，用于随机用户名生成 */
const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
  "Lee",
  "Perez",
  "Thompson",
  "White",
  "Harris",
  "Sanchez",
  "Clark",
  "Ramirez",
  "Lewis",
  "Robinson",
  "Walker",
  "Young",
  "Allen",
  "King",
  "Wright",
  "Scott",
  "Torres",
  "Nguyen",
  "Hill",
  "Flores",
  "Green",
  "Adams",
  "Nelson",
  "Baker",
  "Hall",
  "Rivera",
  "Campbell",
  "Mitchell",
  "Carter",
  "Roberts",
];

interface RegisterOptions {
  server: AppInstance;
  certificateService: CertificateService;
}

export const registerCertificateController = (options: RegisterOptions) => {
  const { server, certificateService } = options;

  server.post(
    "/certificate/rand-name",
    {
      schema: {
        description: "生成随机英文名",
        tags: ["certificate"],
      },
    },
    async () => {
      const firstName =
        FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName =
        LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      return { data: firstName + lastName };
    },
  );

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
