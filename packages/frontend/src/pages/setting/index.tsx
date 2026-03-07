import { FC, Fragment } from "react";
import { Button, Card, Col, Row, Statistic, Switch } from "antd";
import {
  SnippetsOutlined,
  HighlightOutlined,
  CloseCircleOutlined,
  UserOutlined,
  RightOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { Cell, SplitLine } from "@/components/cell";
import { SettingLinkItem, useSetting } from "./use-setting";

interface DesktopProps {
  onClick: () => void;
}

export const DesktopSetting: FC<DesktopProps> = (props) => {
  const setting = useSetting();

  const renderConfigItem = (item: SettingLinkItem) => {
    return (
      <Col span={24} key={item.label}>
        <Button block icon={item.icon} onClick={item.onClick}>
          {item.label}
        </Button>
      </Col>
    );
  };

  return (
    <div style={{ width: "16rem" }}>
      <div style={{ margin: "1rem 0rem" }}>
        <Row gutter={[16, 16]} justify="space-around">
          <Col>
            <Statistic
              title="分组数量"
              value={setting.groupCount}
              prefix={<SnippetsOutlined />}
            />
          </Col>
          <Col>
            <Statistic
              title="凭证数量"
              value={setting.certificateCount}
              prefix={<HighlightOutlined />}
            />
          </Col>
        </Row>
      </div>
      <Row>
        <Col span={24}>
          <div className="flex justify-between items-center mb-4">
            黑夜模式
            <Switch
              checkedChildren="开启"
              unCheckedChildren="关闭"
              onChange={setting.onSwitchTheme}
              checked={setting.userTheme === "dark"}
            />
          </div>
        </Col>
      </Row>
      <Row gutter={[0, 8]} onClick={props.onClick}>
        {setting.settingConfig.map(renderConfigItem)}

        <Col span={24}>
          <Button
            block
            danger
            onClick={setting.onLogout}
            icon={<CloseCircleOutlined />}
            data-testid="logout-btn"
            loading={setting.isLogouting}
          >
            登出
          </Button>
        </Col>
      </Row>
      {setting.renderModal()}
    </div>
  );
};

interface MobileProps {
  onBack: () => void;
}

export const MobileSetting: FC<MobileProps> = () => {
  const setting = useSetting();

  const renderConfigItem = (item: SettingLinkItem, index: number) => {
    return (
      <Fragment key={item.label}>
        <Cell
          title={
            <div>
              {item.icon} &nbsp;{item.label}
            </div>
          }
          onClick={item.onClick}
          extra={<RightOutlined />}
        />
        {index !== setting.settingConfig.length - 1 && <SplitLine />}
      </Fragment>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="text-base m-4">
          <Card size="small">
            <Row justify="space-around">
              <Col>
                <Statistic
                  title="分组数量"
                  value={setting.groupCount}
                  prefix={<SnippetsOutlined />}
                />
              </Col>
              <Col>
                <Statistic
                  title="凭证数量"
                  value={setting.certificateCount}
                  prefix={<HighlightOutlined />}
                />
              </Col>
            </Row>
          </Card>

          <Card size="small" className="mt-4">
            <Cell
              title={
                <div>
                  <UserOutlined /> &nbsp;黑夜模式
                </div>
              }
              extra={
                <Switch
                  checkedChildren="开启"
                  unCheckedChildren="关闭"
                  onChange={setting.onSwitchTheme}
                  checked={setting.userTheme === "dark"}
                />
              }
            />
            <SplitLine />

            {setting.settingConfig.map(renderConfigItem)}
          </Card>

          <Card size="small" className="mt-4">
            <Cell
              onClick={setting.onLogout}
              title={
                <div>
                  <UserOutlined /> &nbsp;登出
                </div>
              }
              extra={<LogoutOutlined />}
            />
          </Card>
          {setting.renderModal()}
        </div>
      </div>
    </div>
  );
};

export default DesktopSetting;
