export function toForwardAttachments(attachments = []) {
    return attachments
        .filter(attachment => !attachment.contentId && attachment.type !== 1)
        .map(attachment => ({
            storageType: 'existing',
            attId: attachment.attId,
            filename: attachment.filename,
            size: attachment.size,
        }));
}
