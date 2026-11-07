/**
 * Anchor v2 tests. Like the parser tests, the client bundle is a single
 * self-contained file, so this test extracts the marked parser + anchor
 * regions from client.js and evaluates them in isolation.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const parserStart = source.indexOf('// #region screenplay-parser')
const parserEnd = source.indexOf('// #endregion screenplay-parser')
const anchorStart = source.indexOf('// #region screenplay-anchor')
const anchorEnd = source.indexOf('// #endregion screenplay-anchor')
assert.ok(parserStart >= 0 && parserEnd > parserStart, 'parser region markers present')
assert.ok(anchorStart >= 0 && anchorEnd > anchorStart, 'anchor region markers present')

const code = `${source.slice(parserStart, parserEnd)}\n${source.slice(anchorStart, anchorEnd)}`
const api = new Function(`${code}\nreturn { parseScreenplay, buildAnchor, reanchorAnnotations }`)()
const { parseScreenplay, buildAnchor, reanchorAnnotations } = api

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`PASS  ${name}`)
}

function annotate(blocks, index, level = 'block', segments) {
  const block = blocks[index]
  return {
    id: 'a1',
    blockIndex: index,
    blockHash: block.hash,
    quote: block.text.slice(0, 24),
    note: 'test',
    tag: '改写',
    level,
    segments,
    anchor: buildAnchor(blocks, index, level, segments),
  }
}

const BASE = '# 标题\n\n场景1 内景 出租屋 夜\n\n▲镜头推近。\n\n施文倩：接听。\n\n陈默：谁？'

test('unchanged draft keeps the anchor and clears stale', () => {
  const blocks = parseScreenplay(BASE)
  const annotation = annotate(blocks, 3)
  annotation.stale = true
  const result = reanchorAnnotations(blocks, [annotation])
  assert.equal(result.stale, 0)
  assert.equal(result.annotations[0].blockIndex, 3)
  assert.equal(result.annotations[0].stale, false)
  assert.equal(result.annotations[0].anchor.blockHash, blocks[3].hash)
})

test('inserting a paragraph before shifts the block index', () => {
  const before = parseScreenplay(BASE)
  const annotation = annotate(before, 3)
  const afterText = '新插入的一段动作。\n\n' + BASE
  const after = parseScreenplay(afterText)
  const result = reanchorAnnotations(after, [annotation])
  assert.equal(result.stale, 0)
  assert.equal(result.annotations[0].blockIndex, 4)
  assert.equal(result.annotations[0].blockHash, after[4].hash)
})

test('duplicate paragraphs are disambiguated by context signature', () => {
  const text = '开头。\n\n重复段落。\n\n重复段落。\n\n结尾。'
  const before = parseScreenplay(text)
  const annotation = annotate(before, 2)
  const after = parseScreenplay('新段落。\n\n' + text)
  const result = reanchorAnnotations(after, [annotation])
  assert.equal(result.stale, 0)
  assert.equal(result.annotations[0].blockIndex, 3)
})

test('edited source text is marked stale, not mis-anchored', () => {
  const before = parseScreenplay(BASE)
  const annotation = annotate(before, 3)
  const after = parseScreenplay(BASE.replace('▲镜头推近。', '▲镜头急速推近，掠过桌面。').replace('施文倩：接听。', '施文倩：喂？'))
  const result = reanchorAnnotations(after, [annotation])
  assert.equal(result.stale, 1)
  assert.equal(result.annotations[0].stale, true)
})

test('sentence segments follow their blocks', () => {
  const before = parseScreenplay(BASE)
  const segments = [
    { blockIndex: 1, blockHash: before[1].hash, text: '场景1 内景' },
    { blockIndex: 2, blockHash: before[2].hash, text: '▲镜头推近。' },
  ]
  const annotation = annotate(before, 1, 'sentence', segments)
  const after = parseScreenplay('新段落。\n\n' + BASE)
  const result = reanchorAnnotations(after, [annotation])
  assert.equal(result.stale, 0)
  assert.equal(result.annotations[0].blockIndex, 2)
  assert.deepEqual(result.annotations[0].segments.map((segment) => segment.blockIndex), [2, 3])
})

test('one edited segment marks the annotation stale', () => {
  const before = parseScreenplay(BASE)
  const segments = [
    { blockIndex: 1, blockHash: before[1].hash, text: '场景1 内景' },
    { blockIndex: 2, blockHash: before[2].hash, text: '▲镜头推近。' },
  ]
  const annotation = annotate(before, 1, 'sentence', segments)
  const after = parseScreenplay(BASE.replace('▲镜头推近。', '▲镜头从窗边缓慢摇过。'))
  const result = reanchorAnnotations(after, [annotation])
  assert.equal(result.stale, 1)
  assert.equal(result.annotations[0].stale, true)
})

test('legacy annotation without anchor still migrates by hash', () => {
  const before = parseScreenplay(BASE)
  const block = before[3]
  const legacy = { id: 'old', blockIndex: 3, blockHash: block.hash, quote: block.text.slice(0, 24), note: 'n', tag: '改写', level: 'block' }
  const after = parseScreenplay('新段落。\n\n' + BASE)
  const result = reanchorAnnotations(after, [legacy])
  assert.equal(result.stale, 0)
  assert.equal(result.annotations[0].blockIndex, 4)
  assert.ok(result.annotations[0].anchor !== undefined)
})

console.log(`\n${passed} anchor tests passed`)
