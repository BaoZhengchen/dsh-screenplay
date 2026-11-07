/**
 * Revision-scope tests: block-level diff + out-of-scope detection.
 * Extracts the marked parser + diff regions from client.js (single-file bundle).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const parserStart = source.indexOf('// #region screenplay-parser')
const parserEnd = source.indexOf('// #endregion screenplay-parser')
const diffStart = source.indexOf('// #region screenplay-diff')
const diffEnd = source.indexOf('// #endregion screenplay-diff')
assert.ok(parserStart >= 0 && parserEnd > parserStart, 'parser region markers present')
assert.ok(diffStart >= 0 && diffEnd > diffStart, 'diff region markers present')

const code = `${source.slice(parserStart, parserEnd)}\n${source.slice(diffStart, diffEnd)}`
const api = new Function(`${code}\nreturn { parseScreenplay, evaluateRevisionScope }`)()
const { parseScreenplay, evaluateRevisionScope } = api

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`PASS  ${name}`)
}

const BASE = '场景1 内景 出租屋 夜\n\n林小满推门进来。\n\n陈默坐在沙发上。\n\n林小满：你还没走？'
const annotation = (blockIndex, tag = '改写') => ({ id: `a${blockIndex}`, blockIndex, tag, note: 'n', level: 'block' })

test('in-scope edit is not reported', () => {
  const base = parseScreenplay(BASE)
  const next = parseScreenplay(BASE.replace('林小满推门进来。', '林小满轻轻推门进来。'))
  const report = evaluateRevisionScope(base, next, [annotation(1)])
  assert.equal(report.outOfScope.length, 0)
  assert.equal(report.inScope, 1)
})

test('unannotated paragraph edit is reported', () => {
  const base = parseScreenplay(BASE)
  const next = parseScreenplay(BASE.replace('陈默坐在沙发上。', '陈默陷在沙发里。'))
  const report = evaluateRevisionScope(base, next, [annotation(1)])
  assert.equal(report.outOfScope.length, 1)
  assert.equal(report.outOfScope[0].kind, 'modified')
  assert.equal(report.outOfScope[0].baseIndex, 2)
})

test('deleting an annotated paragraph is allowed only for 删戏', () => {
  const base = parseScreenplay(BASE)
  const next = parseScreenplay(BASE.replace('\n\n陈默坐在沙发上。', ''))
  const rewrite = evaluateRevisionScope(base, next, [annotation(2, '改写')])
  assert.equal(rewrite.outOfScope.length, 1)
  assert.equal(rewrite.outOfScope[0].kind, 'deleted')
  const deleteTag = evaluateRevisionScope(base, next, [annotation(2, '删戏')])
  assert.equal(deleteTag.outOfScope.length, 0)
  assert.equal(deleteTag.inScope, 1)
})

test('inserting a paragraph after a 加戏 annotation is allowed', () => {
  const base = parseScreenplay(BASE)
  const next = parseScreenplay(`${BASE}\n\n（门铃响了一声。）`)
  const rewrite = evaluateRevisionScope(base, next, [annotation(3, '改写')])
  assert.equal(rewrite.outOfScope.length, 1)
  assert.equal(rewrite.outOfScope[0].kind, 'inserted')
  const addTag = evaluateRevisionScope(base, next, [annotation(3, '加戏')])
  assert.equal(addTag.outOfScope.length, 0)
})

test('unchanged draft reports nothing', () => {
  const base = parseScreenplay(BASE)
  const report = evaluateRevisionScope(base, parseScreenplay(BASE), [annotation(1)])
  assert.equal(report.outOfScope.length, 0)
  assert.equal(report.inScope, 0)
})

test('inserting a paragraph at the start is out of scope', () => {
  const base = parseScreenplay(BASE)
  const next = parseScreenplay(`新开场。\n\n${BASE}`)
  const report = evaluateRevisionScope(base, next, [annotation(1)])
  assert.equal(report.outOfScope.length, 1)
  assert.equal(report.outOfScope[0].kind, 'inserted')
})

test('deleting is allowed when the note asks to delete (even with 改写 tag)', () => {
  const base = parseScreenplay(BASE)
  const next = parseScreenplay(BASE.replace('\n\n陈默坐在沙发上。', ''))
  const note = { id: 'a2', blockIndex: 2, tag: '改写', note: '这一段删了吧', level: 'block' }
  const report = evaluateRevisionScope(base, next, [note])
  assert.equal(report.outOfScope.length, 0)
  assert.equal(report.inScope, 1)
})

test('inserting after a note that asks to add is allowed', () => {
  const base = parseScreenplay(BASE)
  const next = parseScreenplay(`${BASE}\n\n（门铃响了一声。）`)
  const note = { id: 'a3', blockIndex: 3, tag: '改写', note: '这里加一句门铃', level: 'block' }
  const report = evaluateRevisionScope(base, next, [note])
  assert.equal(report.outOfScope.length, 0)
})

console.log(`\n${passed} revision-scope tests passed`)
