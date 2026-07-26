export async function uploadFileDirectlyToR2({
    file,
    disposition = 'attachment',
    createUpload,
    put,
    onUploadProgress
}) {
    const upload = await createUpload({
        filename: file.name || 'attachment',
        contentType: file.type || 'application/octet-stream',
        disposition,
        size: file.size
    })

    if (!upload?.uploadUrl || !upload?.uploadHeaders) {
        throw new Error('Invalid direct upload response')
    }

    await put(upload.uploadUrl, file, {
        headers: upload.uploadHeaders,
        onUploadProgress,
        timeout: 0
    })

    const {
        uploadUrl: _uploadUrl,
        uploadHeaders: _uploadHeaders,
        ...attachment
    } = upload
    return attachment
}
