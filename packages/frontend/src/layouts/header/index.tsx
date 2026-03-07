import { FC, useState } from "react";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import { Button, Popover } from "antd";
import s from "./styles.module.css";
import { DesktopSetting } from "@/pages/setting";
import { useHeaderPageTitle } from "./use-page-title";

interface Props {
  onClickCollapsedIcon: () => void;
  collapsed: boolean;
}

const Header: FC<Props> = (props) => {
  const { onClickCollapsedIcon, collapsed } = props;
  const renderTitle = useHeaderPageTitle();
  const [userMenuVisible, setUserMenuVisible] = useState(false);
  const CollapsedIcon = collapsed ? MenuUnfoldOutlined : MenuFoldOutlined;

  return (
    <header className={s.headerBox}>
      <div className="flex flex-nowrap flex-grow overflow-hidden">
        <CollapsedIcon
          onClick={onClickCollapsedIcon}
          className="text-xl mr-4"
          data-testid="header-collapse-btn"
        />
        {renderTitle()}
      </div>
      <div className="flex flex-nowrap flex-shrink-0 ml-2">
        <Link to="/search">
          <Button
            icon={<SearchOutlined />}
            className="w-60"
            data-testid="header-search-btn"
          >
            搜索
          </Button>
        </Link>
        <Popover
          placement="bottomRight"
          trigger="click"
          content={<DesktopSetting onClick={() => setUserMenuVisible(false)} />}
          open={userMenuVisible}
          onOpenChange={setUserMenuVisible}
          arrow
        >
          <div className="flex flex-nowrap justify-center items-center ml-2 flex-shrink-0">
            <UserOutlined
              className="cursor-pointer text-xl"
              data-testid="header-user-menu-btn"
            />
          </div>
        </Popover>
      </div>
    </header>
  );
};

export default Header;
