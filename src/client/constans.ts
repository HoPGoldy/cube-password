
/**
 * 随机路由前缀
 *
 * 注意这里取了路由里的第一段 path，因为生产环境里会给应用路径加上一个随机前缀路径
 * 这里不加的话就会导致访问不到对应的后端
 */
export const routePrefix = process.env.NODE_ENV === 'development' ? '' : `/${location.pathname.split('/')[1]}`