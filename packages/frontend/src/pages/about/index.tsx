import { FC } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Flex } from "antd";
import {
  LeftOutlined,
  SendOutlined,
  GithubOutlined,
  BarcodeOutlined,
} from "@ant-design/icons";
import { useAppVersion } from "@/services/app-config";
import { usePageTitle } from "@/store/global";

interface AboutItem {
  icon: React.ReactNode;
  title: string;
  description: string;
  link?: string;
}

const AboutPage: FC = () => {
  usePageTitle("关于");
  const navigate = useNavigate();
  const { appVersion } = useAppVersion();

  const aboutItems: AboutItem[] = [
    {
      icon: <SendOutlined />,
      title: "联系我",
      description: "hopgoldy@gmail.com",
      link: `mailto:hopgoldy@gmail.com?&subject=${appVersion?.name || ""} 相关`,
    },
    {
      icon: <BarcodeOutlined />,
      title: "当前版本",
      description: appVersion?.version || "",
    },
    {
      icon: <GithubOutlined />,
      title: "开源地址",
      description: "github",
      link: appVersion?.repository || "",
    },
  ];

  const renderAboutItem = (item: AboutItem) => {
    const el = (
      <div
        className="p-3 text-gray-500 dark:text-neutral-200 bg-gray-100 dark:bg-neutral-700 rounded-md"
        key={item.title}
      >
        <Flex justify="space-between">
          <div className="dark:text-neutral-300">
            {item.icon} &nbsp;{item.title}
          </div>
          <div>{item.description}</div>
        </Flex>
      </div>
    );

    if (item.link) {
      return (
        <a key={item.title} href={item.link} target="_blank" rel="noreferrer">
          {el}
        </a>
      );
    }

    return el;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center p-3 border-b border-gray-200">
        <Button
          icon={<LeftOutlined />}
          type="text"
          onClick={() => navigate("/settings")}
        />
        <span className="ml-2 text-lg font-medium">
          关于 {appVersion?.name || "Cube Password"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-md mx-auto">
          <p className="text-base mb-6">
            安全可靠的自托管密码管理器。
            <br />
            <br />
            支持分组管理、动态验证码、双端响应式布局、数据自托管等功能。
          </p>

          <Flex gap={16} vertical className="mb-6">
            {aboutItems.map(renderAboutItem)}
          </Flex>

          <div className="text-center text-gray-400 text-sm">
            Powered by 💗 Yuzizi
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
