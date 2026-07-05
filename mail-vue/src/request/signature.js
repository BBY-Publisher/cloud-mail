import http from '@/axios/index.js';

export function signatureList() {
    return http.get('/signature/list')
}

export function signatureGet(email) {
    return http.get('/signature/get', {params: {email}, noMsg: true})
}

export function signatureSet(params) {
    return http.put('/signature/set', params)
}
