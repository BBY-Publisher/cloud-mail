import http from '@/axios/index.js';
import axios from 'axios';
import {uploadFileDirectlyToR2} from '@/utils/direct-r2-upload.js';

export function emailList(accountId, allReceive, emailId, timeSort, size, type, keyword = '') {
    return http.get('/email/list', {params: {accountId, allReceive, emailId, timeSort, size, type, keyword}})
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
    return uploadFileDirectlyToR2({
        file,
        disposition,
        createUpload: metadata => http.post('/email/attachment/presign', metadata, {
            noMsg: true
        }),
        put: (url, body, options) => axios.put(url, body, options),
        onUploadProgress: progress
    })
}

export function emailSync() {
    return http.post('/email/sync', null, { noMsg: true, timeout: 120 * 1000 })
}
