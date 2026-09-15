import assert from 'node:assert/strict'
import test from 'node:test'

import {formatRecipientList, getEmailListContact} from './email-list-contact.js'

test('getEmailListContact displays recipients for sent messages', () => {
  assert.equal(getEmailListContact({
    type: 1,
    name: 'Sender',
    recipient: JSON.stringify([{name: '', address: 'recipient@example.com'}]),
    toEmail: 'fallback@example.com',
  }), 'recipient@example.com')
})

test('getEmailListContact keeps the sender for received messages', () => {
  assert.equal(getEmailListContact({
    type: 0,
    name: 'Sender',
    recipient: JSON.stringify([{name: '', address: 'recipient@example.com'}]),
  }), 'Sender')
})

test('formatRecipientList displays every recipient with available names', () => {
  const recipient = JSON.stringify([
    {name: 'Alice', address: 'alice@example.com'},
    {name: '', address: 'bob@example.com'},
  ])

  assert.equal(
    formatRecipientList(recipient, 'fallback@example.com'),
    'Alice <alice@example.com>, bob@example.com',
  )
})

test('formatRecipientList falls back when the recipient list is empty or missing', () => {
  assert.equal(formatRecipientList('[]', 'fallback@example.com'), 'fallback@example.com')
  assert.equal(formatRecipientList(null, 'fallback@example.com'), 'fallback@example.com')
})

test('formatRecipientList preserves a legacy plain-text recipient', () => {
  assert.equal(formatRecipientList('legacy@example.com'), 'legacy@example.com')
})
