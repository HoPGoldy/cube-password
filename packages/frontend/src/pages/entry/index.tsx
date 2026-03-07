import { Navigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { stateUser } from "@/store/user";

const Entry = () => {
  const defaultGroupId = useAtomValue(stateUser)?.defaultGroupId;
  return <Navigate to={`/group/${defaultGroupId}`} replace />;
};

export default Entry;
