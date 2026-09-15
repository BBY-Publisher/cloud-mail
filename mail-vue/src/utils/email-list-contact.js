export function formatEmailContact(name, address) {
  const normalizedName = String(name || '').trim()
  const normalizedAddress = String(address || '').trim()

  if (!normalizedAddress) return normalizedName
  if (!normalizedName) return normalizedAddress

  const localPart = normalizedAddress.split('@')[0]
  const hasAlias = normalizedName.toLowerCase() !== localPart.toLowerCase()
    && normalizedName.toLowerCase() !== normalizedAddress.toLowerCase()

  return hasAlias ? `${normalizedName} (${normalizedAddress})` : normalizedAddress
}

export function formatRecipientList(recipient, fallback = '') {
  let recipientList = recipient

  if (typeof recipientList === 'string') {
    try {
      recipientList = JSON.parse(recipientList)
    } catch (_) {
      return recipientList.trim() || fallback
    }
  }

  if (!Array.isArray(recipientList)) return fallback

  const recipients = recipientList.map(item => {
    if (typeof item === 'string') return item.trim()

    return formatEmailContact(item?.name, item?.address || item?.email)
  }).filter(Boolean)

  return recipients.join(', ') || fallback
}

export function getEmailListContact(email, listType = '') {
  const sender = formatEmailContact(email?.name, email?.sendEmail)
  const recipients = formatRecipientList(email?.recipient, email?.toEmail)

  if (listType === 'all-email') return sender

  const contacts = listType === 'send' || (listType === 'star' && Number(email?.type) === 1)
    ? [recipients, sender]
    : [sender, recipients]

  return contacts.filter(Boolean).join(' / ')
}
