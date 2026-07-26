import test from 'node:test'
import assert from 'node:assert/strict'
import { uploadFileDirectlyToR2 } from './direct-r2-upload.js'

test('requests a presigned URL and uploads file bytes directly to R2', async () => {
    const file = {
        name: 'report.pdf',
        type: 'application/pdf',
        size: 1024
    }
    const createUpload = async metadata => {
        assert.deepEqual(metadata, {
            filename: 'report.pdf',
            contentType: 'application/pdf',
            disposition: 'attachment',
            size: 1024
        })
        return {
            storageType: 'R2',
            key: 'attachments/11111111-1111-4111-8111-111111111111.pdf',
            url: 'https://mail.example.com/api/oss/attachments/11111111-1111-4111-8111-111111111111.pdf',
            uploadUrl: 'https://cloud-mail.account.r2.cloudflarestorage.com/signed',
            uploadHeaders: {
                'Content-Type': 'application/pdf'
            },
            filename: 'report.pdf',
            contentType: 'application/pdf',
            size: 1024
        }
    }
    let uploaded = false
    const put = async (url, body, options) => {
        uploaded = true
        assert.equal(url, 'https://cloud-mail.account.r2.cloudflarestorage.com/signed')
        assert.equal(body, file)
        assert.deepEqual(options.headers, {'Content-Type': 'application/pdf'})
    }

    const attachment = await uploadFileDirectlyToR2({
        file,
        disposition: 'attachment',
        createUpload,
        put
    })

    assert.equal(uploaded, true)
    assert.equal(attachment.storageType, 'R2')
    assert.equal(attachment.filename, 'report.pdf')
    assert.equal(attachment.uploadUrl, undefined)
    assert.equal(attachment.uploadHeaders, undefined)
})
