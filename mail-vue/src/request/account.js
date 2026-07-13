import http from '@/axios/index.js'

export function accountList(accountId, size, lastSort) {
    return http.get('/account/list', {params: {accountId, size, lastSort}});
}

export function accountAdd(email,token) {
    return http.post('/account/add', {email,token})
}

export function accountSetName(accountId,name) {
    return http.put('/account/setName', {name,accountId})
}

export function accountDelete(accountId) {
    return http.delete('/account/delete', {params: {accountId}})
}

export function accountSetAllReceive(accountId) {
    return http.put('/account/setAllReceive', {accountId})
}

export function accountSetAsTop(accountId) {
    return http.put('/account/setAsTop', {accountId})
}

export function accountMemberList(accountId) {
    return http.get('/account/member/list', {params: {accountId}});
}

export function accountMemberAdd(accountId, email, role) {
    return http.post('/account/member/add', {accountId, email, role});
}

export function accountMemberRemove(accountId, userId) {
    return http.delete('/account/member/remove', {params: {accountId, userId}});
}

export function accountMemberSetRole(accountId, userId, role) {
    return http.put('/account/member/role', {accountId, userId, role});
}