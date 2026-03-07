import { FC } from "react";
import { Card } from "antd";
import { GithubOutlined, SendOutlined } from "@ant-design/icons";
import { Cell } from "@/components/cell";
import { SettingContainerProps } from "@/components/setting-container";
import { useAppVersion } from "@/services/app-config";

export const Content: FC<SettingContainerProps> = () => {
  const { appVersion } = useAppVersion();

  return (
    <>
      <div className="text-base mx-auto">
        <Card size="small" className="mt-4 text-base">
          安全可靠的自托管密码管理器。
          <br />
          <br />
          支持分组管理、动态验证码、双端响应式布局、数据自托管等功能。
        </Card>
        <Card size="small" className="mt-4">
          <a
            href={`mailto:hopgoldy@gmail.com?&subject=${appVersion?.name || ""} 相关`}
          >
            <Cell
              title={
                <div className="dark:text-neutral-300">
                  <SendOutlined /> &nbsp;联系我
                </div>
              }
              extra={
                <div className="text-gray-500 dark:text-neutral-200">
                  hopgoldy@gmail.com
                </div>
              }
            />
          </a>
        </Card>
        <Card size="small" className="mt-4">
          <a
            href={appVersion?.repository || "#"}
            target="_blank"
            rel="noreferrer"
          >
            <Cell
              title={
                <div className="dark:text-neutral-300">
                  <GithubOutlined /> &nbsp;开源地址
                </div>
              }
              extra={
                <div className="text-gray-500 dark:text-neutral-200">
                  github
                </div>
              }
            />
          </a>
        </Card>
      </div>

      <div className="text-center w-full bottom-0 text-mainColor mt-4 md:mb-4 dark:text-gray-200">
        {"Powered by 💗 Yuzizi"}
      </div>
    </>
  );
};
