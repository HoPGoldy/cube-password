/**
 * 数据存放路径
 */
export const STORAGE_PATH = './.storage'

/**
 * 接口返回的状态码
 */
export const STATUS_CODE = {
    NOT_REGISTER: 40101,
    ALREADY_REGISTER: 40102,
    /**
     * 分组未验证密码
     */
    GROUP_NOT_VERIFY_PASSWORD: 40103,
    /**
     * 分组密码错误
     */
    GROUP_PASSWORD_ERROR: 40104,
    /**
     * 因为关联了其他资源所以无法删除
     */
    CANT_DELETE: 40601
}

/**
 * 统一的日期格式化
 */
export const DATE_FORMATTER = 'YYYY-MM-DD HH:mm:ss'