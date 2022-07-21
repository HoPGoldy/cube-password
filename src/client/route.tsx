import React, { ComponentType, FC, lazy, Suspense, useLayoutEffect, useState } from 'react'
import { Router, useRoutes } from 'react-router-dom'
import { createBrowserHistory } from 'history'
import Loading from './components/Loading'
import { LoginAuth } from './components/LoginAuth'
import { AppContainer } from './components/AppContainer'

const lazyLoad = (compLoader: () => Promise<{ default: ComponentType<any> }>) => {
    const Comp = lazy(compLoader)
    return (
        <Suspense fallback={<Loading />}>
            <Comp />
        </Suspense>
    )
}

export const Routes: FC = () => {
    const routes = useRoutes([
        {
            path: '/',
            children: [
                { path: '/group/:groupId', element: lazyLoad(() => import('./pages/GroupList')) },
                { path: '/addGroup', element: lazyLoad(() => import('./pages/AddGroup')) },
            ],
            element: (
                <LoginAuth>
                    <AppContainer />
                </LoginAuth>
            )
        },
        {
            path: '/login',
            element: lazyLoad(() => import('./pages/Login'))
        }
    ])

    return routes
}

/**
 * 暴露实例，用于组件外导航
 */
export const history = createBrowserHistory({ window })

/**
 * 暴露了 history 实例的路由组件
 */
export const BrowserRouter: FC = (props) => {
    const [state, setState] = useState({
        action: history.action,
        location: history.location
    })

    useLayoutEffect(() => history.listen(setState), [history])

    return (
        <Router
            {...props}
            location={state.location}
            navigationType={state.action}
            navigator={history}
        />
    )
}