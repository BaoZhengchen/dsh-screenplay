/**
 * Screenplay mode — Host half.
 *
 * Owns everything the browser panel cannot: the `/screenplay` session command,
 * the version sidecar (`剧本/.dsh-screenplay/<script>/`), file watching, and the
 * one model-visible handoff (`agent.steer` with a constrained revision request).
 *
 * Design notes:
 * - No session event types are added; the only model-visible artifact is one
 *   user message per sent annotation batch.
 * - The command is registered with `recordInput: false`, so annotation payloads
 *   never enter the session log; the sidecar is the authoritative record.
 * - `ctx.fs` performs all content I/O (atomic writes). `node:fs/promises.mkdir`
 *   is used only to create the sidecar directory, because `ctx.fs` exposes no
 *   directory-creation primitive.
 *
 * @module @local/dsh-screenplay
 */

import { mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { basename, dirname, isAbsolute, join, relative, resolve as resolvePath } from 'node:path'

/** Scripts live under this workspace-relative directory (also hardcoded in client.js). */
const SCRIPT_DIR = '剧本'
/** Hidden sidecar directory inside the script directory. */
const SIDECAR_DIR = '.dsh-screenplay'
/** Supported script extensions. */
const ALLOWED_EXT = /\.(md|txt|fountain)$/i
const MAX_ANNOTATIONS = 200
const MAX_NOTE_CHARS = 1000
const MAX_TOTAL_NOTE_CHARS = 30000
const MAX_QUOTE_CHARS = 400
const SETTLE_DEBOUNCE_MS = 2500
const FALLBACK_POLL_MS = 3000
const SEND_COALESCE_MS = 5 * 60 * 1000
const BUSY_TIMEOUT_MS = 10 * 60 * 1000
const TEMPLATE_NAME = '第一集.md'
const TEMPLATE_BODY =
  '# 第一集\n\n（在这里写场景、动作与对白。段落之间空一行，方便在右栏按段批注。）\n'

/** Services this plugin needs before it may activate. */
export const inject = ['commands', 'fs', 'workingDirectory']

const toPosix = (path) => path.replace(/\\/g, '/')
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex')
const nowIso = () => new Date().toISOString()
const randomRevisionId = (seq) => `r${seq}-${Math.random().toString(16).slice(2, 8)}`
const messageOf = (error) =>
  error !== null && typeof error === 'object' && typeof error.message === 'string'
    ? error.message
    : String(error)

class ScreenplayFailure extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

const fail = (code, message) => {
  throw new ScreenplayFailure(code, message)
}

/** Deep-freeze a plain value (mirrors the runtime's immutable message helpers). */
function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value
  Object.freeze(value)
  for (const key of Object.keys(value)) deepFreeze(value[key])
  return value
}

/**
 * Build the same shape `createUserMessage` from `@deepseek-ai/dsh-llm` produces.
 * Kept local so the bundle carries no runtime import that a linked package
 * directory might fail to resolve.
 *
 * @param input - content and source of the user message.
 * @returns a frozen user-role message with a fresh identity.
 */
function createUserMessage(input) {
  return deepFreeze({
    ...structuredClone(input),
    role: 'user',
    id: `msg-${globalThis.crypto.randomUUID()}`,
  })
}

const truncate = (text, max) => (text.length <= max ? text : `${text.slice(0, max)}…`)

/**
 * Plugin body.
 * @param {import('@deepseek-ai/cordis').Context} ctx - host context.
 */
export function apply(ctx) {
  /** key -> watch entry */
  const watches = new Map()
  /** agent id -> true while its agent-scoped disposer is registered */
  const agentScopes = new Set()
  /** script docRel -> start timestamp while a revision is in flight */
  const busy = new Map()
  /** script docRel -> owning agent id */
  const busyOwner = new Map()
  /** script docRel -> timeout handle */
  const busyTimers = new Map()

  const watchKey = (agent, docRel) => `${agent.id}\u0000${docRel}`

  // ── lifecycle ────────────────────────────────────────────────────────────

  ctx.effect(
    () => () => {
      for (const entry of [...watches.values()]) void disposeWatch(entry)
      watches.clear()
      for (const timer of busyTimers.values()) clearTimeout(timer)
      busyTimers.clear()
      busy.clear()
      busyOwner.clear()
    },
    'screenplay: watches and locks',
  )

  function ensureAgentScope(agent) {
    const key = String(agent.id)
    if (agentScopes.has(key)) return
    agentScopes.add(key)
    try {
      agent.ctx.effect(
        () => () => {
          for (const [entryKey, entry] of [...watches]) {
            if (entry.agentId === key) {
              watches.delete(entryKey)
              void disposeWatch(entry)
            }
          }
          for (const [docRel, owner] of [...busyOwner]) {
            if (owner === key) releaseBusy(docRel)
          }
          agentScopes.delete(key)
        },
        'screenplay: agent watchers',
      )
    } catch (error) {
      ctx.logger?.warn?.('screenplay: could not scope watchers to the agent', error)
    }
  }

  // ── sandbox policy ───────────────────────────────────────────────────────

  /**
   * Resolve the effective execution policy for one command invocation so the
   * `fs` backend fences our own writes exactly like a model tool call would.
   * Agentless profiles without a sandbox-policy service keep the backend's
   * default behavior.
   */
  function policyFor(agent) {
    try {
      const service = ctx.get('sandboxPolicy')
      if (service !== undefined && service !== null && typeof service.resolve === 'function') {
        return service.resolve({ session: agent.session })
      }
    } catch (error) {
      ctx.logger?.warn?.('screenplay: could not resolve the sandbox policy', error)
    }
    return undefined
  }

  // ── paths ────────────────────────────────────────────────────────────────

  async function workspaceRootOf(agent) {
    const root = ctx.workingDirectory.get(agent.session)
    if (typeof root !== 'string' || root === '') fail('E_NO_WORKSPACE', '当前会话没有可用工作区')
    return resolvePath(root)
  }

  /**
   * Resolve a payload's `doc` into the workspace, the script directory, and the
   * sidecar identity, rejecting anything outside `剧本/`.
   */
  async function resolveDoc(agent, payload) {
    const docPath = payload !== null && typeof payload === 'object' && typeof payload.doc === 'string'
      ? payload.doc.trim()
      : ''
    if (docPath === '') fail('E_BAD_REQUEST', '缺少 doc 参数')
    const root = await workspaceRootOf(agent)
    const scriptRoot = resolvePath(root, SCRIPT_DIR)
    const target = await ctx.fs.resolve(docPath, { cwd: root })
    const absolute = ctx.fs.processPath(target)
    const relToScript = relative(scriptRoot, absolute)
    if (relToScript === '' || relToScript.startsWith('..') || isAbsolute(relToScript)) {
      fail('E_OUTSIDE', `剧本只能位于工作区的 ${SCRIPT_DIR}/ 目录内`)
    }
    if (!ALLOWED_EXT.test(absolute)) fail('E_OUTSIDE', '只支持 .md / .txt / .fountain 剧本文件')
    return {
      root,
      target,
      absolute,
      docRel: toPosix(relative(root, absolute)),
      docName: basename(absolute),
    }
  }

  function sidecarOf(doc) {
    const dir = join(doc.root, SCRIPT_DIR, SIDECAR_DIR, doc.docName)
    return { dir, docName: doc.docName }
  }

  const indexPathOf = (sidecar) => join(sidecar.dir, 'index.json')
  const revisionPathOf = (sidecar, id) => join(sidecar.dir, 'revisions', `${id}.json`)
  const snapshotPathOf = (sidecar, hash) => join(sidecar.dir, 'snapshots', `${hash}.md`)

  // ── sidecar I/O ──────────────────────────────────────────────────────────

  async function readSidecarText(absolutePath) {
    const target = await ctx.fs.resolve(absolutePath)
    const info = await ctx.fs.stat(target)
    if (info === undefined) return undefined
    return ctx.fs.readText(target)
  }

  async function readSidecarJson(absolutePath) {
    const text = await readSidecarText(absolutePath)
    if (text === undefined) return undefined
    try {
      return JSON.parse(text)
    } catch {
      return undefined
    }
  }

  async function writeSidecarJson(absolutePath, value, policy) {
    await mkdir(dirname(absolutePath), { recursive: true })
    const target = await ctx.fs.resolve(absolutePath)
    return ctx.fs.writeText(target, `${JSON.stringify(value, null, 2)}\n`, undefined, undefined, policy)
  }

  async function ensureSnapshot(sidecar, hash, text, policy) {
    if (typeof hash !== 'string' || hash === '') return
    const absolutePath = snapshotPathOf(sidecar, hash)
    const target = await ctx.fs.resolve(absolutePath)
    const info = await ctx.fs.stat(target)
    if (info !== undefined) return
    await mkdir(dirname(absolutePath), { recursive: true })
    await ctx.fs.writeText(target, text, undefined, undefined, policy)
  }

  function lastRevision(index) {
    if (index === null || typeof index !== 'object' || !Array.isArray(index.revisions)) return undefined
    return index.revisions.length === 0 ? undefined : index.revisions[index.revisions.length - 1]
  }

  async function loadIndex(doc, text, version, policy) {
    const sidecar = sidecarOf(doc)
    const existing = await readSidecarJson(indexPathOf(sidecar))
    if (existing !== undefined && existing !== null && Array.isArray(existing.revisions)) {
      return { index: existing, sidecar }
    }
    const hash = sha256(text)
    await mkdir(join(sidecar.dir, 'snapshots'), { recursive: true })
    await mkdir(join(sidecar.dir, 'revisions'), { recursive: true })
    await ensureSnapshot(sidecar, hash, text, policy)
    const revision = {
      id: randomRevisionId(1),
      seq: 1,
      time: nowIso(),
      kind: 'initial',
      label: '初稿',
      baseVersion: null,
      resultVersion: typeof version === 'string' ? version : null,
      baseHash: null,
      resultHash: hash,
      annotationCount: 0,
      state: 'applied',
      appliedAt: nowIso(),
    }
    const index = { schemaVersion: 1, script: sidecar.docName, nextSeq: 2, head: revision.id, revisions: [revision] }
    await writeSidecarJson(indexPathOf(sidecar), index, policy)
    return { index, sidecar }
  }

  async function saveIndex(sidecar, index, policy) {
    await writeSidecarJson(indexPathOf(sidecar), index, policy)
  }

  // ── locks ────────────────────────────────────────────────────────────────

  function acquireBusy(agent, docRel) {
    if (busy.has(docRel)) fail('E_BUSY', '该剧本正在改稿中，请等本轮完成后再发送')
    busy.set(docRel, Date.now())
    busyOwner.set(docRel, String(agent.id))
    const timer = setTimeout(() => releaseBusy(docRel), BUSY_TIMEOUT_MS)
    if (typeof timer.unref === 'function') timer.unref()
    busyTimers.set(docRel, timer)
  }

  function releaseBusy(docRel) {
    const timer = busyTimers.get(docRel)
    if (timer !== undefined) clearTimeout(timer)
    busyTimers.delete(docRel)
    busy.delete(docRel)
    busyOwner.delete(docRel)
  }

  // ── watcher ──────────────────────────────────────────────────────────────

  async function ensureWatch(agent, doc) {
    const key = watchKey(agent, doc.docRel)
    if (watches.has(key)) return
    const controller = new AbortController()
    const entry = {
      key,
      agentId: String(agent.id),
      agent,
      doc,
      controller,
      close: undefined,
      timer: undefined,
      poll: undefined,
      settling: false,
      disposed: false,
    }
    watches.set(key, entry)
    try {
      entry.close = await ctx.fs.watch(
        doc.target,
        (error) => {
          if (error !== undefined) ctx.logger?.warn?.('screenplay: watch reported an error', error)
          scheduleSettle(entry)
        },
        controller.signal,
      )
    } catch (error) {
      // Watching is optional: fall back to a slow host-side poll so revisions
      // still finalize on backends without a watch primitive.
      ctx.logger?.warn?.('screenplay: file watch unavailable, polling instead', error)
      entry.poll = setInterval(() => scheduleSettle(entry), FALLBACK_POLL_MS)
      if (typeof entry.poll.unref === 'function') entry.poll.unref()
    }
  }

  function scheduleSettle(entry) {
    if (entry.disposed) return
    if (entry.timer !== undefined) clearTimeout(entry.timer)
    entry.timer = setTimeout(() => {
      entry.timer = undefined
      void settle(entry)
    }, SETTLE_DEBOUNCE_MS)
    if (typeof entry.timer.unref === 'function') entry.timer.unref()
  }

  async function settle(entry) {
    if (entry.disposed || entry.settling || entry.controller.signal.aborted) return
    entry.settling = true
    try {
      const target = await ctx.fs.resolve(entry.doc.absolute)
      const info = await ctx.fs.stat(target)
      if (info === undefined) return
      const text = await ctx.fs.readText(target)
      const hash = sha256(text)
      const sidecar = sidecarOf(entry.doc)
      const index = await readSidecarJson(indexPathOf(sidecar))
      const head = lastRevision(index)
      if (head === undefined) return
      const policy = policyFor(entry.agent)

      if (head.state === 'pending') {
        if (hash === head.baseHash) return
        head.resultVersion = info.version
        head.resultHash = hash
        head.state = 'applied'
        head.appliedAt = nowIso()
        await ensureSnapshot(sidecar, hash, text, policy)
        await saveIndex(sidecar, index, policy)
        releaseBusy(entry.doc.docRel)
        return
      }

      const coalescing =
        head.kind === 'send' &&
        head.state === 'applied' &&
        typeof head.appliedAt === 'string' &&
        Date.now() - Date.parse(head.appliedAt) < SEND_COALESCE_MS
      if (coalescing) {
        if (hash === head.resultHash) return
        head.resultVersion = info.version
        head.resultHash = hash
        head.appliedAt = nowIso()
        await ensureSnapshot(sidecar, hash, text, policy)
        await saveIndex(sidecar, index, policy)
        return
      }

      if (hash === head.resultHash) return
      const seq = index.nextSeq
      const revision = {
        id: randomRevisionId(seq),
        seq,
        time: nowIso(),
        kind: 'external',
        label: '面板外改动',
        baseVersion: head.resultVersion ?? null,
        resultVersion: info.version,
        baseHash: head.resultHash ?? null,
        resultHash: hash,
        annotationCount: 0,
        state: 'applied',
        appliedAt: nowIso(),
      }
      await ensureSnapshot(sidecar, hash, text, policy)
      index.revisions.push(revision)
      index.nextSeq = seq + 1
      index.head = revision.id
      await saveIndex(sidecar, index, policy)
    } catch (error) {
      ctx.logger?.warn?.('screenplay: could not settle a revision', error)
    } finally {
      entry.settling = false
    }
  }

  async function disposeWatch(entry) {
    if (entry.disposed) return
    entry.disposed = true
    if (entry.timer !== undefined) clearTimeout(entry.timer)
    if (entry.poll !== undefined) clearInterval(entry.poll)
    try {
      entry.controller.abort()
    } catch {
      /* already aborted */
    }
    if (entry.close !== undefined) {
      try {
        await entry.close()
      } catch {
        /* watcher already gone */
      }
    }
  }

  // ── payload helpers ──────────────────────────────────────────────────────

  function decodePayload(raw) {
    const trimmed = raw.trim()
    if (trimmed === '') return {}
    let parsed
    try {
      parsed = JSON.parse(Buffer.from(trimmed, 'base64url').toString('utf8'))
    } catch {
      fail('E_BAD_REQUEST', '参数无法解析（需要 base64url 编码的 JSON）')
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      fail('E_BAD_REQUEST', '参数必须是一个 JSON 对象')
    }
    return parsed
  }

  function normalizeAnnotations(raw) {
    if (!Array.isArray(raw) || raw.length === 0) fail('E_BAD_REQUEST', '没有可发送的批注')
    if (raw.length > MAX_ANNOTATIONS) fail('E_TOO_MANY', `一次最多发送 ${MAX_ANNOTATIONS} 条批注`)
    let total = 0
    return raw.map((item, position) => {
      const note = item !== null && typeof item === 'object' && typeof item.note === 'string' ? item.note.trim() : ''
      if (note === '') fail('E_BAD_REQUEST', `第 ${position + 1} 条批注没有内容`)
      if (note.length > MAX_NOTE_CHARS) fail('E_TOO_MANY', `第 ${position + 1} 条批注超过 ${MAX_NOTE_CHARS} 字`)
      total += note.length
      const quote = item !== null && typeof item === 'object' && typeof item.quote === 'string'
        ? item.quote.slice(0, MAX_QUOTE_CHARS)
        : ''
      const tag = item !== null && typeof item === 'object' && typeof item.tag === 'string' && item.tag.trim() !== ''
        ? item.tag.trim().slice(0, 16)
        : '改稿'
      return {
        id: item !== null && typeof item === 'object' && typeof item.id === 'string' ? item.id.slice(0, 64) : `a${position + 1}`,
        blockIndex: item !== null && typeof item === 'object' && Number.isInteger(item.blockIndex) ? item.blockIndex : -1,
        blockHash: item !== null && typeof item === 'object' && typeof item.blockHash === 'string' ? item.blockHash.slice(0, 64) : '',
        quote,
        note,
        tag,
        level: item !== null && typeof item === 'object' && item.level === 'sentence' ? 'sentence' : 'block',
      }
    }).map((annotation) => {
      if (total > MAX_TOTAL_NOTE_CHARS) fail('E_TOO_MANY', `批注总字数超过 ${MAX_TOTAL_NOTE_CHARS}`)
      return annotation
    })
  }

  function composeMessage(doc, revision, annotations) {
    const lines = [
      `用户对《${doc.docRel}》提交了 ${annotations.length} 条批注（rev ${revision.id}）。请直接修改这个文件。`,
      '',
      '要求：',
      '1. 只修改批注涉及的段落；其他段落、场景标题、格式保持原样。',
      '2. 用 edit 工具做最小改动；不要重写全文、不要重排段落、不要顺手润色未批注内容。',
      '3. 批注之间冲突时，先说明冲突，再按用户意见择一执行。',
      '4. 完成后逐条回复：批注编号 → 落在了哪一段（引用开头几个字）或未落实原因。',
      '',
      '批注：',
      ...annotations.map(
        (annotation, index) =>
          `#${index + 1} [${annotation.tag}${annotation.level === 'sentence' ? ' · 句级' : ''}] 引用：「${truncate(annotation.quote.replace(/\s+/g, ' '), 80)}」 → ${annotation.note}`,
      ),
    ]
    return lines.join('\n')
  }

  // ── subcommands ──────────────────────────────────────────────────────────

  async function openDoc(agent, payload) {
    const doc = await resolveDoc(agent, payload)
    const info = await ctx.fs.stat(doc.target)
    if (info === undefined) fail('E_NOT_FOUND', '剧本文件不存在')
    const text = await ctx.fs.readText(doc.target)
    const policy = policyFor(agent)
    const { index, sidecar } = await loadIndex(doc, text, info.version, policy)
    const lastOpened = typeof index.lastOpenedAt === 'string' ? Date.parse(index.lastOpenedAt) : 0
    if (!Number.isFinite(lastOpened) || Date.now() - lastOpened > 30000) {
      index.lastOpenedAt = nowIso()
      try {
        await saveIndex(sidecar, index, policy)
      } catch (error) {
        ctx.logger?.warn?.('screenplay: could not record lastOpenedAt', error)
      }
    }
    await ensureWatch(agent, doc)
    return { revision: index.head ?? null, seq: lastRevision(index)?.seq ?? 0 }
  }

  async function sendDoc(agent, payload) {
    const doc = await resolveDoc(agent, payload)
    const info = await ctx.fs.stat(doc.target)
    if (info === undefined) fail('E_NOT_FOUND', '剧本文件不存在')
    const text = await ctx.fs.readText(doc.target)
    const annotations = normalizeAnnotations(payload.annotations)
    const policy = policyFor(agent)
    const baseVersion = typeof payload.baseVersion === 'string' ? payload.baseVersion : ''
    if (baseVersion === '' || baseVersion !== info.version) {
      fail('E_STALE', '稿件已更新，请重新定位批注后再发送')
    }
    acquireBusy(agent, doc.docRel)
    try {
      const { index, sidecar } = await loadIndex(doc, text, info.version, policy)
      const baseHash = sha256(text)
      const seq = index.nextSeq
      const revision = {
        id: randomRevisionId(seq),
        seq,
        time: nowIso(),
        kind: 'send',
        label: `批注改稿 ${annotations.length} 条`,
        baseVersion: info.version,
        resultVersion: null,
        baseHash,
        resultHash: null,
        annotationCount: annotations.length,
        state: 'pending',
      }
      await ensureSnapshot(sidecar, baseHash, text, policy)
      await writeSidecarJson(revisionPathOf(sidecar, revision.id), {
        doc: doc.docRel,
        baseHash,
        createdAt: revision.time,
        annotations,
      }, policy)
      index.revisions.push(revision)
      index.nextSeq = seq + 1
      index.head = revision.id
      await saveIndex(sidecar, index, policy)
      const message = composeMessage(doc, revision, annotations)
      try {
        agent.steer(createUserMessage({ content: [{ type: 'text', text: message }], source: { kind: 'user' } }))
      } catch (error) {
        fail('E_STEER', `无法把批注交给模型：${messageOf(error)}`)
      }
      await ensureWatch(agent, doc)
      return { revision: revision.id, seq, state: 'pending' }
    } catch (error) {
      releaseBusy(doc.docRel)
      throw error
    }
  }

  async function snapshotDoc(agent, payload) {
    const doc = await resolveDoc(agent, payload)
    const info = await ctx.fs.stat(doc.target)
    if (info === undefined) fail('E_NOT_FOUND', '剧本文件不存在')
    const text = await ctx.fs.readText(doc.target)
    const policy = policyFor(agent)
    const { index, sidecar } = await loadIndex(doc, text, info.version, policy)
    const head = lastRevision(index)
    const hash = sha256(text)
    if (head !== undefined && head.resultHash === hash && head.state === 'applied') {
      return { revision: head.id, seq: head.seq, unchanged: true }
    }
    await ensureSnapshot(sidecar, hash, text, policy)
    const seq = index.nextSeq
    const label = typeof payload.label === 'string' && payload.label.trim() !== '' ? payload.label.trim().slice(0, 40) : '手动保存'
    const revision = {
      id: randomRevisionId(seq),
      seq,
      time: nowIso(),
      kind: 'manual',
      label,
      baseVersion: head?.resultVersion ?? null,
      resultVersion: info.version,
      baseHash: head?.resultHash ?? null,
      resultHash: hash,
      annotationCount: 0,
      state: 'applied',
      appliedAt: nowIso(),
    }
    index.revisions.push(revision)
    index.nextSeq = seq + 1
    index.head = revision.id
    await saveIndex(sidecar, index, policy)
    await ensureWatch(agent, doc)
    return { revision: revision.id, seq, unchanged: false }
  }

  async function restoreDoc(agent, payload) {
    const doc = await resolveDoc(agent, payload)
    const revisionId = typeof payload.revision === 'string' ? payload.revision : ''
    if (revisionId === '') fail('E_BAD_REQUEST', '缺少要恢复的版本 id')
    const info = await ctx.fs.stat(doc.target)
    if (info === undefined) fail('E_NOT_FOUND', '剧本文件不存在')
    const currentText = await ctx.fs.readText(doc.target)
    const policy = policyFor(agent)
    const { index, sidecar } = await loadIndex(doc, currentText, info.version, policy)
    const wanted = index.revisions.find((revision) => revision !== null && typeof revision === 'object' && revision.id === revisionId)
    if (wanted === undefined) fail('E_NOT_FOUND', `版本 ${revisionId} 不存在`)
    const hash = typeof wanted.resultHash === 'string' ? wanted.resultHash : wanted.baseHash
    if (typeof hash !== 'string' || hash === '') fail('E_NOT_FOUND', '该版本没有可恢复的内容快照')
    const snapshotText = await readSidecarText(snapshotPathOf(sidecar, hash))
    if (snapshotText === undefined) fail('E_NOT_FOUND', '该版本的内容快照文件缺失')
    const currentHash = sha256(currentText)
    await ensureSnapshot(sidecar, currentHash, currentText, policy)
    const writeTarget = await ctx.fs.resolve(doc.absolute)
    try {
      await ctx.fs.writeText(writeTarget, snapshotText, { kind: 'replaceIfVersion', version: info.version }, undefined, policy)
    } catch (error) {
      fail('E_STALE', `恢复失败：${messageOf(error)}`)
    }
    const afterInfo = await ctx.fs.stat(writeTarget)
    if (afterInfo === undefined) fail('E_IO', '恢复写入后无法读取文件')
    const afterText = await ctx.fs.readText(writeTarget)
    const seq = index.nextSeq
    const revision = {
      id: randomRevisionId(seq),
      seq,
      time: nowIso(),
      kind: 'restore',
      label: `恢复到 v${wanted.seq}`,
      baseVersion: info.version,
      resultVersion: afterInfo.version,
      baseHash: currentHash,
      resultHash: sha256(afterText),
      annotationCount: 0,
      state: 'applied',
      appliedAt: nowIso(),
    }
    index.revisions.push(revision)
    index.nextSeq = seq + 1
    index.head = revision.id
    await saveIndex(sidecar, index, policy)
    await ensureWatch(agent, doc)
    return { revision: revision.id, seq, restoredFrom: wanted.seq }
  }

  async function initDoc(agent) {
    const root = await workspaceRootOf(agent)
    const policy = policyFor(agent)
    const scriptRoot = join(root, SCRIPT_DIR)
    await mkdir(scriptRoot, { recursive: true })
    const scriptRel = `${SCRIPT_DIR}/${TEMPLATE_NAME}`
    const target = await ctx.fs.resolve(scriptRel, { cwd: root })
    const info = await ctx.fs.stat(target)
    if (info === undefined) await ctx.fs.writeText(target, TEMPLATE_BODY, { kind: 'createIfAbsent' }, undefined, policy)
    return { script: scriptRel }
  }

  // ── command ──────────────────────────────────────────────────────────────

  ctx.effect(
    () => ctx.commands.register({
    name: 'screenplay',
    description: '剧本模式：打开剧本、按批注改稿、保存版本、恢复版本（供右栏剧本面板调用）',
    recordInput: false,
    handler: async ({ agent, rawInput }) => {
      ensureAgentScope(agent)
      const input = rawInput.trimStart()
      const split = input.search(/\s/)
      const sub = (split === -1 ? input : input.slice(0, split)).trim().toLowerCase()
      const argument = split === -1 ? '' : input.slice(split + 1).trim()
      try {
        let value
        switch (sub) {
          case 'open':
            value = await openDoc(agent, decodePayload(argument))
            break
          case 'send':
            value = await sendDoc(agent, decodePayload(argument))
            break
          case 'snapshot':
            value = await snapshotDoc(agent, decodePayload(argument))
            break
          case 'restore':
            value = await restoreDoc(agent, decodePayload(argument))
            break
          case 'init':
            value = await initDoc(agent)
            break
          case 'ping':
            value = { ok: true, scriptDir: SCRIPT_DIR }
            break
          default:
            fail('E_SYNTAX', `未知子命令「${sub || '(空)'}」，可用：open / send / snapshot / restore / init`)
        }
        return { kind: 'success', text: `OK ${JSON.stringify(value)}` }
      } catch (error) {
        const code = error instanceof ScreenplayFailure ? error.code : 'E_IO'
        if (!(error instanceof ScreenplayFailure)) ctx.logger?.warn?.('screenplay: command failed', error)
        return { kind: 'error', text: `ERR ${code}: ${messageOf(error)}` }
      }
    },
    }),
    'screenplay: command registration',
  )
}
