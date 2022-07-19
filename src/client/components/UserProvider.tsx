import React, { Dispatch, FC, SetStateAction, useState } from 'react'

export interface UserProfile {
    token: string
}

export const UserContext = React.createContext<[
    UserProfile | undefined,
    Dispatch<SetStateAction<UserProfile | undefined>>
]>([undefined, () => console.error('UserContext is not initialized')])

export const UserProvider: FC = (props) => {
    const [user, setUser] = useState<UserProfile>()

    return (
        <UserContext.Provider value={[user, setUser]}>
            {props.children}
        </UserContext.Provider>
    )
}