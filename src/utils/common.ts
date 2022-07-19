import sha512 from 'crypto-js/sha512'

export const sha = (str: string) => {
    return sha512(str).toString().toUpperCase()
}
