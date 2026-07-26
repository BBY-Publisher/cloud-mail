import assert from 'node:assert/strict'
import test from 'node:test'

import { getExtName } from './file-utils.js'

test('getExtName returns an empty extension for a missing filename', () => {
    assert.equal(getExtName(null), '')
    assert.equal(getExtName(undefined), '')
})

test('getExtName keeps extracting extensions from valid filenames', () => {
    assert.equal(getExtName('report.PDF'), 'pdf')
    assert.equal(getExtName('README'), '')
})
