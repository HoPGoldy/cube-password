import React, { Dispatch, FC, SetStateAction, useState } from 'react'
import { UserInfo } from '@/types/demo'

export const UserContext = React.createContext<[
    UserInfo | undefined,
    Dispatch<SetStateAction<UserInfo | undefined>>
]>([undefined, () => console.error('UserContext is not initialized')])

export const UserProvider: FC = (props) => {
    const [user, setUser] = useState<UserInfo>()

    return (
        <UserContext.Provider value={[user, setUser]}>
            {props.children}
        </UserContext.Provider>
    )
}