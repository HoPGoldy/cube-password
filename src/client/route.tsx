import React, { ComponentType, FC, lazy, Suspense, useLayoutEffect, useState } from 'react'
import { Router, useRoutes } from 'react-router-dom'
import { createBrowserHistory } from 'history'
import Loading from './components/Loading'
import { LoginAuth } from './components/LoginAuth'
import { AppContainer } from './components/AppContainer'

/**
 * 随机路由前缀
 *
 * 注意这里取了路由里的第一段 path，因为生产环境里会给应用路径加上一个随机前缀路径
 * 这里不加的话就会导致访问不到对应的后端
 */
export const routePrefix = process.env.NODE_ENV === 'development' ? '' : `/${location.pathname.split('/')[1]}`

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
            path: routePrefix + '/',
            children: [
                { path: routePrefix + '/group', element: lazyLoad(() => import('./pages/CertificateList')) },
                { path: routePrefix + '/addGroup', element: lazyLoad(() => import('./pages/AddGroup')) },
                { path: routePrefix + '/securityEntry', element: lazyLoad(() => import('./pages/SecurityMonitor')) },
                { path: routePrefix + '/LogRequest', element: lazyLoad(() => import('./pages/LogRequest')) },
                { path: routePrefix + '/LogLogin', element: lazyLoad(() => import('./pages/LogLogin')) },
                { path: routePrefix + '/LogCertificate', element: lazyLoad(() => import('./pages/LogCertificate')) },
                { path: routePrefix + '/NoticeList', element: lazyLoad(() => import('./pages/NoticeList')) },
                { path: routePrefix + '/setting', element: lazyLoad(() => import('./pages/Setting')) },
                { path: routePrefix + '/about', element: lazyLoad(() => import('./pages/About')) }
            ],
            element: (
                <LoginAuth>
                    <AppContainer />
                </LoginAuth>
            )
        },
        {
            path: routePrefix + '/login',
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