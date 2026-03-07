import { Content } from "./content";
import {
  SettingContainer,
  SettingContainerProps,
} from "@/components/setting-container";
import { useSearchParams } from "react-router-dom";

const TITLE = "安全日志";
const PARAM_KEY = "showSecureLog";

export default () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const visible = searchParams.get(PARAM_KEY) === "1";

  const showModal = () => {
    searchParams.set(PARAM_KEY, "1");
    setSearchParams(searchParams);
  };

  const closeModal = () => {
    searchParams.delete(PARAM_KEY);
    setSearchParams(searchParams, { replace: true });
  };

  const renderModal = () => {
    const props: SettingContainerProps = {
      title: TITLE,
      open: visible,
      onClose: closeModal,
      modalProps: { width: "50%" },
    };

    return (
      <SettingContainer {...props}>
        <Content {...props} />
      </SettingContainer>
    );
  };

  return { showModal, renderModal };
};
