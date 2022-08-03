import { customAlphabet } from 'nanoid'

const alphabet = '-=_+[]{}();/:",.<>?0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
export const createPwd = customAlphabet(alphabet, 24)
