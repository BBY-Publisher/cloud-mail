import assert from 'node:assert/strict'
import test from 'node:test'

import {
    MAX_COMPOSE_FILE_SIZE,
    classifyComposeFiles,
    isImageUpload
} from './compose-upload.js'

function file(name, type, size) {
    return { name, type, size }
}

test('compose uploads allow files up to and including 64 MiB', () => {
    const accepted = file('archive.zip', 'application/zip', MAX_COMPOSE_FILE_SIZE)
    const rejected = file('too-large.zip', 'application/zip', MAX_COMPOSE_FILE_SIZE + 1)

    assert.deepEqual(classifyComposeFiles([accepted, rejected]), {
        accepted: [accepted],
        rejected: [rejected]
    })
})

test('compose uploads recognize images by MIME type with extension fallback', () => {
    assert.equal(isImageUpload(file('photo.bin', 'image/png', 1)), true)
    assert.equal(isImageUpload(file('photo.JPEG', '', 1)), true)
    assert.equal(isImageUpload(file('report.pdf', 'application/pdf', 1)), false)
})

test('compose uploads reject empty files and missing file records', () => {
    const empty = file('empty.txt', 'text/plain', 0)

    assert.deepEqual(classifyComposeFiles([null, empty]), {
        accepted: [],
        rejected: [empty]
    })
})
