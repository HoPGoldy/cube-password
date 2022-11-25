import React, { ComponentType, FC, lazy, Suspense, useLayoutEffect, useState } from 'react'
import { Router, useRoutes, useNavigate as useRouterNavigate, NavigateFunction, Link as RouterLink, LinkProps } from 'react-router-dom'
import { createBrowserHistory } from 'history'
import Loading from './components/Loading'
import { LoginAuth } from './components/LoginAuth'
import { AppContainer } from './components/AppContainer'
import { routePrefix } from './constans'

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
                { path: routePrefix + '/Setting', element: lazyLoad(() => import('./pages/Setting')) },
                { path: routePrefix + '/About', element: lazyLoad(() => import('./pages/About')) },
                { path: routePrefix + '/ChangePassword', element: lazyLoad(() => import('./pages/ChangePassword')) },
                { path: routePrefix + '/OtpManage', element: lazyLoad(() => import('./pages/OtpManage')) },
                { path: routePrefix + '/GroupManage', element: lazyLoad(() => import('./pages/GroupManage')) },
                { path: routePrefix + '/CreatePwdSetting', element: lazyLoad(() => import('./pages/CreatePwdSetting')) },
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

export const useNavigate = (): NavigateFunction => {
    const nav = useRouterNavigate()

    return (arg1, ...args) => {
        const realArg1 = typeof arg1 === 'string' ? routePrefix + arg1 : arg1
        return (nav as any)(realArg1, ...args)
    }
}

export const Link: FC<LinkProps> = (props) => {
    const { to, ...restProps } = props
    const realTo = routePrefix + to

    return (
        <RouterLink to={realTo} {...restProps}>
            {props.children}
        </RouterLink>
    )
}
