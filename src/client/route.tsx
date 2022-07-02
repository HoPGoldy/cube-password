import React, { FC, lazy, Suspense, useLayoutEffect, useState } from 'react'
import { Router, useRoutes } from 'react-router-dom'
import { createBrowserHistory } from 'history'
import Loading from './components/Loading'

const Home = lazy(() => import('./pages/Home'))
const RequestDemo = lazy(() => import('./pages/RequestDemo'))
const AuthDemo = lazy(() => import('./pages/AuthDemo'))

export const Routes: FC = () => {
    const routes = useRoutes([
        {
            path: '/',
            element: (
                <Suspense fallback={<Loading />}>
                    <Home />
                </Suspense>
            )
        },
        {
            path: '/requestDemo',
            element: (
                <Suspense fallback={<Loading />}>
                    <RequestDemo />
                </Suspense>
            )
        },
        {
            path: '/authDemo',
            element: (
                <Suspense fallback={<Loading />}>
                    <AuthDemo />
                </Suspense>
            )
        },
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