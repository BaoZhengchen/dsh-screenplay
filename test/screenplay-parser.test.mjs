/**
 * Screenplay parser tests.
 *
 * The client bundle is a single self-contained file (no build step), so this
 * test extracts the marked parser region from client.js and evaluates it in
 * isolation. Run with `node test/screenplay-parser.test.mjs` or `npm test`.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const start = source.indexOf('// #region screenplay-parser')
const end = source.indexOf('// #endregion screenplay-parser')
assert.ok(start >= 0 && end > start, 'parser region markers are present in client.js')

const region = source.slice(start, end)
const factory = new Function(`${region}\nreturn { parseScreenplay, classifyScreenplayLine }`)
const { parseScreenplay, classifyScreenplayLine } = factory()

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`PASS  ${name}`)
}
const types = (blocks) => blocks.map((block) => block.type)

test('Chinese scene + shot + inline dialogue', () => {
  const blocks = parseScreenplay('场景1 内景 出租屋 夜\n\n▲镜头推近，落在门口的皮鞋上。\n\n电视新闻（画外）：本台消息。\n\n施文倩：接听。')
  assert.deepEqual(types(blocks), ['scene_heading', 'shot', 'dialogue', 'dialogue'])
  assert.equal(blocks[2].inline, true)
  assert.equal(blocks[2].inlineSpeaker, '电视新闻（画外）：')
  assert.equal(blocks[3].inlineSpeaker, '施文倩：')
})

test('Chinese cue block with parenthetical', () => {
  const text = '夜。\n\n林小满\n（低声）\n你走吧。\n\n陈默\n（没动）外面在下雨。'
  const blocks = parseScreenplay(text)
  assert.deepEqual(types(blocks), ['action', 'dialogue', 'dialogue'])
  assert.equal(blocks[1].speaker, '林小满')
  assert.deepEqual(blocks[1].lines.map((line) => line.type), ['character', 'parenthetical', 'dialogue'])
  assert.equal(blocks[2].lines.length, 2)
})

test('English standard screenplay elements', () => {
  const text = 'INT. ROOM - NIGHT\n\nAction here.\n\nCHANG\n(quietly)\nIf the reel exists.\n\nCUT TO BLACK.'
  const blocks = parseScreenplay(text)
  assert.deepEqual(types(blocks), ['scene_heading', 'action', 'dialogue', 'transition'])
  assert.equal(blocks[2].lines[0].text, 'CHANG')
  assert.equal(blocks[2].lines[1].type, 'parenthetical')
})

test('heading and note blocks', () => {
  const blocks = parseScreenplay('# 剧本标题\n\n## 第一幕：清晨\n\n[[伏笔：钥匙]]')
  assert.deepEqual(types(blocks), ['heading', 'heading', 'note'])
  assert.equal(blocks[0].headingLevel, 1)
  assert.equal(blocks[1].headingLevel, 2)
  assert.equal(blocks[1].text, '第一幕：清晨')
})

test('block text round trip (no heading marks)', () => {
  const text = '场景1 内景 出租屋 夜\n\n▲镜头。\n\n施文倩：接听。'
  const blocks = parseScreenplay(text)
  assert.equal(blocks.map((block) => block.text).join('\n\n'), text)
})

test('meta inline labels stay action', () => {
  assert.equal(classifyScreenplayLine('一句话梗概：一个故事。').type, 'action')
  assert.equal(classifyScreenplayLine('时间：夜').type, 'action')
})

test('transition and forced elements', () => {
  assert.equal(classifyScreenplayLine('切至：').type, 'transition')
  assert.equal(classifyScreenplayLine('CUT TO:').type, 'transition')
  assert.equal(classifyScreenplayLine('> 淡出').type, 'transition')
})

console.log(`\n${passed} parser tests passed`)
