import http from '@/axios/index.js';

export function emailList(accountId, allReceive, emailId, timeSort, size, type) {
    return http.get('/email/list', {params: {accountId, allReceive, emailId, timeSort, size, type}})
}

export function emailDelete(emailIds) {
    return http.delete('/email/delete?emailIds=' + emailIds)
}

export function emailLatest(emailId, accountId, allReceive) {
    return http.get('/email/latest', {params: {emailId, accountId, allReceive}, noMsg: true, timeout: 35 * 1000})
}

export function emailRead(emailIds) {
    return http.put('/email/read', {emailIds})
}

export function emailSend(form,progress) {
    return http.post('/email/send', form,{
        onUploadProgress: (e) => {
            progress(e)
        },
        noMsg: true
    })
}

export function attachmentUpload(file, disposition = 'attachment', progress = () => {}) {
    return http.put('/email/attachment/upload', file, {
        headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'X-File-Name': encodeURIComponent(file.name || 'attachment'),
            'X-File-Disposition': disposition,
            'X-File-Size': String(file.size),
        },
        onUploadProgress: progress,
        noMsg: true,
        timeout: 0,
    })
}

export function emailSync() {
    return http.post('/email/sync', null, { noMsg: true, timeout: 120 * 1000 })
}
