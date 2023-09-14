import { LockType } from '@/types/group';
import { useAtomValue } from 'jotai';
import { stateUser } from '@/client/store/user';

export const useLockTypeOptions = () => {
  const userInfo = useAtomValue(stateUser);
  const lockTypeOptions = [
    { label: '不加密', value: LockType.None },
    { label: '密码加密', value: LockType.Password },
  ];

  if (userInfo?.withTotp) {
    lockTypeOptions.push({ label: 'TOTP 加密', value: LockType.Totp });
  }

  return lockTypeOptions;
};
