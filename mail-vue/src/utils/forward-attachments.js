export function toForwardAttachments(attachments = []) {
    return attachments
        // Content-ID can also be present on ordinary files. Match the attachment
        // list shown in the message; only EMBED rows belong exclusively to HTML.
        .filter(attachment => attachment.type !== 1)
        .map(attachment => ({
            storageType: 'existing',
            attId: attachment.attId,
            filename: attachment.filename,
            size: attachment.size,
        }));
}
