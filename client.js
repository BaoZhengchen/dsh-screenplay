/**
 * Screenplay mode — browser half.
 *
 * Registers a right-sidebar tab type that claims script files under `剧本/`,
 * renders an annotation panel, and talks to the left half through the session
 * command `/screenplay send|open|snapshot|restore|init`. File reads and stats go
 * through the generated `remote.workspaceFiles` namespace.
 *
 * Plain-JS module loaded by the Harness browser module table; React comes from
 * that table, never from a bundled copy.
 *
 * @module @local/dsh-screenplay/client
 */

window.__ModuleLoader__.load({
  id: '@local/dsh-screenplay',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useMemo, useRef, useCallback } = React

    const PACKAGE_ID = '@local/dsh-screenplay'
    const NS = 'screenplay'
    const KIND = 'screenplay'
    const BUILD = '0.4.1'
    const SCRIPT_DIR = '剧本'
    const SIDECAR_DIR = '.dsh-screenplay'
    const DOC_EXT = /\.(md|txt|fountain)$/i
    const FILE_PREFIX = 'dsh-resource://file/'
    const TAGS = ['改写', '删戏', '加戏', '逻辑', '节奏', '台词']

    // ── locale ─────────────────────────────────────────────────────────────

    const zh = {
      'tab.title': '剧本模式',
      'tab.description': '在右栏批注剧本，一键交给编剧 Agent 改稿',
      'workbench.title': '剧本模式',
      'workbench.hint': '把剧本放在「剧本/」目录下，或先创建一个模板。',
      'workbench.empty': '剧本/ 目录还没有剧本',
      'workbench.init': '创建剧本模板',
      'workbench.open': '打开',
      'workbench.refresh': '刷新',
      'workbench.loading': '读取剧本目录…',
      'workbench.error': '读取剧本目录失败：{msg}',
      'doc.loading': '读取剧本中…',
      'doc.error': '读取剧本失败：{msg}',
      'doc.retry': '重试',
      'doc.empty': '这个文件还是空的。',
      'badge.version': 'v{seq}',
      'badge.pending': '改稿中',
      'btn.refresh': '刷新',
      'btn.versions': '版本',
      'btn.annotate': '批注',
      'btn.save': '保存批注',
      'btn.cancel': '取消',
      'btn.delete': '删除',
      'btn.typography': '排版',
      'btn.toc': '目录',
      'btn.annotateSelection': '批注所选',
      'btn.backToTop': '回到顶部',
      'btn.send': '发送 {n} 条批注',
      'btn.sending': '发送中…',
      'btn.cancelPending': '结束等待',
      'versions.abandoned': '已结束',
      'btn.restore': '恢复此版本',
      'btn.view': '查看',
      'btn.diff': '对比上一版',
      'btn.hideDiff': '收起对比',
      'btn.close': '关闭',
      'btn.relocate': '重新定位',
      'btn.back': '返回列表',
      'footer.none': '还没有批注',
      'footer.count': '已批注 {n} 段',
      'footer.pending': '上一轮改稿进行中…',
      'editor.placeholder': '写批注：哪里要改、怎么改…',
      'editor.tag': '类型',
      'banner.stale': '稿件已更新，批注基于旧版。发送前请先重新定位。',
      'banner.revisionOutOfScope': '本次改稿有 {n} 处越界改动（批注范围之外），请检查。',
      'btn.viewReport': '查看差异',
      'btn.rollbackRevision': '回滚本次改稿',
      'btn.dismiss': '知道了',
      'toast.sent': '已发送 {n} 条批注，等待改稿…',
      'toast.applied': '改稿完成，已生成 v{seq}。',
      'toast.stale': '稿件已更新，请先重新定位批注',
      'toast.failed': '操作失败：{msg}',
      'toast.relocated': '批注已按最新稿重新定位',
      'toast.relocatedPartial': '批注已重新定位，{n} 条没匹配上，请手动检查',
      'toast.timeout': '等待超时，改稿可能仍在进行。稍后点刷新查看新版本。',
      'toast.cancelled': '已结束等待，可以继续发送批注。',
      'toast.reanchored': '稿件已更新，批注已自动重新定位。',
      'toast.reanchoredPartial': '稿件已更新，{n} 条批注没匹配上，请手动检查。',
      'toast.revisionOutOfScope': '改稿完成，但检测到 {n} 处越界改动。',
      'toast.appliedScoped': '改稿完成，已生成 v{seq}；改动都在批注范围内。',
      'toast.rolledBack': '已回滚本次改稿。',
      'toast.noRollbackBase': '没有可用于回滚的基础版本。',
      'report.title': '改稿差异 · v{seq}',
      'report.summary': '越界改动 {n} 处，批注范围内改动 {m} 处。',
      'report.noIssues': '没有越界改动。',
      'report.kind.modified': '越界修改',
      'report.kind.inserted': '新增段落',
      'report.kind.deleted': '删除段落',
      'report.before': '原文：',
      'report.after': '改后：',
      'typography.title': '排版',
      'typography.lineHeight': '行距（段内）',
      'typography.blockGap': '段距（段间）',
      'typography.hint': '行距控制同一段落内部的行间空白；段距控制段落与段落之间的空白。下面的预览会实时跟随。',
      'group.annotationCount': '已批注 {n} 段',
      'typography.fontSize': '字号',
      'typography.reset': '恢复默认',
      'toc.title': '目录',
      'toc.empty': '还没有场次标题',
      'toast.restored': '已恢复到 v{from}，当前生成 v{current}',
      'versions.title': '版本',
      'versions.empty': '还没有版本记录',
      'versions.current': '当前',
      'versions.annotations': '{n} 条批注',
      'versions.kind.initial': '初稿',
      'versions.kind.send': '批注改稿',
      'versions.kind.manual': '手动保存',
      'versions.kind.external': '面板外改动',
      'versions.kind.restore': '恢复',
      'versions.loading': '读取版本内容…',
      'versions.error': '读取版本失败：{msg}',
      'versions.preview': '版本 v{seq}',
      'versions.diffTitle': '对比 v{from} → v{to}',
      'staleModal.title': '稿件已更新',
      'staleModal.body': '批注基于旧版，最新稿是 v{latest}。可以按段落重新定位后再发送。',
      'note.unmatched': '未匹配到最新稿的段落，请手动检查或删除',
      'staleModal.cancel': '取消',
      'error.noSession': '没有可用的会话',
    }

    const en = {
      'tab.title': 'Screenplay mode',
      'tab.description': 'Annotate a screenplay in the right sidebar and send the notes to the writing agent',
      'workbench.title': 'Screenplay mode',
      'workbench.hint': 'Put scripts under the 剧本/ directory, or create a template first.',
      'workbench.empty': 'No scripts in 剧本/ yet',
      'workbench.init': 'Create script template',
      'workbench.open': 'Open',
      'workbench.refresh': 'Refresh',
      'workbench.loading': 'Reading script directory…',
      'workbench.error': 'Could not read the script directory: {msg}',
      'doc.loading': 'Reading screenplay…',
      'doc.error': 'Could not read the screenplay: {msg}',
      'doc.retry': 'Retry',
      'doc.empty': 'This file is empty.',
      'badge.version': 'v{seq}',
      'badge.pending': 'Revising',
      'btn.refresh': 'Refresh',
      'btn.versions': 'Versions',
      'btn.annotate': 'Annotate',
      'btn.save': 'Save note',
      'btn.cancel': 'Cancel',
      'btn.delete': 'Delete',
      'btn.typography': 'Typography',
      'btn.toc': 'Contents',
      'btn.annotateSelection': 'Annotate selection',
      'btn.backToTop': 'Back to top',
      'btn.send': 'Send {n} notes',
      'btn.sending': 'Sending…',
      'btn.cancelPending': 'Finish waiting',
      'versions.abandoned': 'Abandoned',
      'btn.restore': 'Restore this version',
      'btn.view': 'View',
      'btn.diff': 'Diff previous',
      'btn.hideDiff': 'Hide diff',
      'btn.close': 'Close',
      'btn.relocate': 'Re-anchor',
      'btn.back': 'Back to list',
      'footer.none': 'No notes yet',
      'footer.count': '{n} annotated paragraphs',
      'footer.pending': 'Previous revision in progress…',
      'editor.placeholder': 'What should change here, and how?',
      'editor.tag': 'Kind',
      'banner.stale': 'The script changed; these notes are based on an older draft. Re-anchor before sending.',
      'banner.revisionOutOfScope': 'The revision changed {n} paragraph(s) outside the annotated range — please review.',
      'btn.viewReport': 'View changes',
      'btn.rollbackRevision': 'Roll back this revision',
      'btn.dismiss': 'Dismiss',
      'toast.sent': 'Sent {n} notes; waiting for the revision…',
      'toast.applied': 'Revision finished as v{seq}.',
      'toast.stale': 'The script changed; re-anchor the notes first',
      'toast.failed': 'Failed: {msg}',
      'toast.relocated': 'Notes re-anchored to the latest draft',
      'toast.relocatedPartial': 'Re-anchored, but {n} notes found no match; please check them',
      'toast.timeout': 'Timed out waiting; the revision may still be running. Refresh later to check.',
      'toast.cancelled': 'Stopped waiting; you can send annotations again.',
      'toast.reanchored': 'The script changed; notes were re-anchored automatically.',
      'toast.reanchoredPartial': 'The script changed; {n} notes found no match — please check them.',
      'toast.revisionOutOfScope': 'Revision finished, but {n} change(s) outside the annotated range were detected.',
      'toast.appliedScoped': 'Revision finished as v{seq}; all changes stayed inside the annotated range.',
      'toast.rolledBack': 'Rolled back this revision.',
      'toast.noRollbackBase': 'No base version to roll back to.',
      'report.title': 'Revision diff · v{seq}',
      'report.summary': '{n} change(s) outside the annotated range; {m} change(s) inside.',
      'report.noIssues': 'No out-of-scope changes.',
      'report.kind.modified': 'Out-of-scope edit',
      'report.kind.inserted': 'Paragraph added',
      'report.kind.deleted': 'Paragraph deleted',
      'report.before': 'Before: ',
      'report.after': 'After: ',
      'typography.title': 'Typography',
      'typography.lineHeight': 'Line spacing (within)',
      'typography.blockGap': 'Paragraph spacing (between)',
      'typography.hint': 'Line spacing controls the gap between lines inside one paragraph; paragraph spacing adds space between paragraphs. The preview below updates live.',
      'group.annotationCount': 'Annotated {n} blocks',
      'typography.fontSize': 'Font size',
      'typography.reset': 'Reset',
      'toc.title': 'Contents',
      'toc.empty': 'No scene headings yet',
      'toast.restored': 'Restored v{from}; current is v{current}',
      'versions.title': 'Versions',
      'versions.empty': 'No revisions yet',
      'versions.current': 'Current',
      'versions.annotations': '{n} notes',
      'versions.kind.initial': 'Initial',
      'versions.kind.send': 'Annotated revision',
      'versions.kind.manual': 'Manual save',
      'versions.kind.external': 'Changed outside the panel',
      'versions.kind.restore': 'Restore',
      'versions.loading': 'Reading version…',
      'versions.error': 'Could not read the version: {msg}',
      'versions.preview': 'Version v{seq}',
      'versions.diffTitle': 'v{from} → v{to}',
      'staleModal.title': 'The script changed',
      'staleModal.body': 'These notes were made against an older draft; the latest is v{latest}. Re-anchor them by paragraph before sending.',
      'note.unmatched': 'This note found no matching paragraph in the latest draft; check or delete it',
      'staleModal.cancel': 'Cancel',
      'error.noSession': 'No session available',
    }

    // ── addressing ─────────────────────────────────────────────────────────

    const encodeSegment = (segment) => encodeURIComponent(segment).replace(/%3A/gi, ':')
    const encodePath = (path) => path.split('/').map(encodeSegment).join('/')

    function sessionFileAddress(sessionId, path) {
      const normalized = String(path).replace(/\\/g, '/').replace(/^(?:\.\/)+/, '')
      return `${FILE_PREFIX}session/${encodeSegment(sessionId)}/${encodePath(normalized)}`
    }

    function parseFileAddress(address) {
      if (typeof address !== 'string' || !address.startsWith(FILE_PREFIX)) return null
      const segments = address.slice(FILE_PREFIX.length).split('/')
      if (segments[0] !== 'session' || segments.length < 3) return null
      let sessionId
      try {
        sessionId = decodeURIComponent(segments[1])
      } catch {
        return null
      }
      let path
      try {
        path = segments.slice(2).map((segment) => decodeURIComponent(segment)).join('/')
      } catch {
        return null
      }
      return { sessionId, path }
    }

    function isScriptPath(rawPath) {
      let path = String(rawPath).replace(/\\/g, '/')
      path = path.replace(/^(?:\.\/)+/, '')
      if (path.startsWith(`${SCRIPT_DIR}/`)) return true
      return path.includes(`/${SCRIPT_DIR}/`)
    }

    function baseName(path) {
      const normalized = String(path).replace(/\\/g, '/')
      return normalized.slice(normalized.lastIndexOf('/') + 1)
    }

    function sidecarRelPath(docPath, ...rest) {
      const normalized = String(docPath).replace(/\\/g, '/').replace(/^(?:\.\/)+/, '')
      const segments = normalized.split('/')
      const name = segments.pop() || ''
      const dir = segments.length > 0 ? `${segments.join('/')}/` : ''
      return `${dir}${SIDECAR_DIR}/${name}/${rest.join('/')}`
    }

    // ── screenplay block model (P0-1) ──────────────────────────────────────
    // #region screenplay-parser
    // Eight screenplay element types (aligned with Narracore's typed blocks) plus
    // an internal `heading` for acts/titles. Each paragraph block is the
    // annotation unit; its typed lines drive rendering, TOC and future export.

    function fnv1a(text) {
      let hash = 0x811c9dc5
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index)
        hash = Math.imul(hash, 0x01000193)
      }
      return (hash >>> 0).toString(16).padStart(8, '0')
    }

    const META_SPEAKERS = new Set(['一句话梗概', '梗概', '人物表', '场景表', '时间', '地点', '备注'])
    const ENGLISH_SCENE_RE = /^(?:INT|EXT|EST|INT\.?\/EXT\.?|I\/E)[\s./]/i
    const CHINESE_SCENE_RE = /^(?:第\s*[0-9一二三四五六七八九十百零〇两]+\s*[场幕]|场\s*[0-9一二三四五六七八九十百零〇两]+|场景\s*[0-9一二三四五六七八九十百零〇两]+|\d+\s*[-－]\s*\d+\s*(?:内景|外景|内|外)|(?:内景|外景|内外景)\s)/
    const CHINESE_SCENE_CONTAINS_RE = /(?:内景|外景)/
    const TRANSITION_RE = /^(?:切至|切到|叠化|淡入|淡出|闪回|闪出|划入|划出|FADE\s+(?:IN|OUT)|CUT\s+TO|DISSOLVE\s+TO|SMASH\s+CUT|MATCH\s+CUT)/i
    const TRANSITION_CAPS_RE = /^[A-Z0-9 .,'()\-]+TO:?$/
    const SHOT_RE = /^(?:▲|镜头|特写|近景|中景|远景|全景|空镜|俯拍|仰拍|航拍|跟拍|摇镜|推镜|拉镜|升格|降格)/
    const NOTE_RE = /^\[\[[\s\S]*\]\]$/
    const PAREN_RE = /^[（(][\s\S]*[）)]$/
    const INLINE_DIALOGUE_RE = /^([^：:]{1,24})[：:]([\s\S]*)$/
    const HEADING_RE = /^(#{1,6})\s+/

    function classifyScreenplayLine(rawLine) {
      const line = String(rawLine).trim()
      if (line === '') return { type: 'blank' }
      const heading = HEADING_RE.exec(line)
      if (heading !== null) return { type: 'heading', level: heading[1].length }
      if (NOTE_RE.test(line)) return { type: 'note' }
      if (ENGLISH_SCENE_RE.test(line)) return { type: 'scene_heading' }
      if (CHINESE_SCENE_RE.test(line)) return { type: 'scene_heading' }
      if (CHINESE_SCENE_CONTAINS_RE.test(line) && line.length <= 40) return { type: 'scene_heading' }
      if (TRANSITION_RE.test(line) || TRANSITION_CAPS_RE.test(line) || /^>/.test(line)) return { type: 'transition' }
      if (SHOT_RE.test(line)) return { type: 'shot' }
      if (PAREN_RE.test(line)) return { type: 'parenthetical' }
      const dialogue = INLINE_DIALOGUE_RE.exec(line)
      if (dialogue !== null) {
        const speaker = dialogue[1].trim()
        if (!/^(?:https?|mailto|file|www)$/i.test(speaker) && !META_SPEAKERS.has(speaker)) {
          return { type: 'inline_dialogue', speaker, text: dialogue[2] }
        }
      }
      return { type: 'action' }
    }

    function isCueCandidate(rawLine) {
      const line = String(rawLine).trim()
      if (line === '' || line.length > 12) return false
      if (/[。！？!?，,、；;：:]$/.test(line)) return false
      if (/^[▲#\[（(>「“"—\-]/.test(line)) return false
      if (CHINESE_SCENE_RE.test(line) || ENGLISH_SCENE_RE.test(line) || TRANSITION_RE.test(line)) return false
      return true
    }

    function isEnglishCueCandidate(rawLine) {
      const line = String(rawLine).trim()
      return line.length > 0 && line.length <= 30 && /^[A-Z][A-Z0-9 .'()\-]*$/.test(line) && !/[.:]$/.test(line)
    }

    function isStructuralScreenplayLine(classified) {
      return classified.type === 'scene_heading' || classified.type === 'heading' || classified.type === 'transition' || classified.type === 'note'
    }

    /**
     * Parse screenplay text into paragraph blocks. A block is the annotation
     * unit and carries typed lines for rendering, TOC and export.
     *
     * @param text - raw screenplay text.
     * @returns blocks: `{ index, type, text, hash, lines, speaker?, inline?, headingLevel? }`.
     */
    function parseScreenplay(text) {
      const normalized = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      const chunks = normalized.split(/\n[ \t]*\n+/)
      const blocks = []
      const pushBlock = (lines, extra) => {
        const body = lines.map((line) => line.text)
        const blockText = body.join('\n')
        if (blockText.trim() === '') return
        blocks.push(Object.assign({
          index: blocks.length,
          text: blockText,
          hash: fnv1a(blockText.trim()),
          lines,
        }, extra === undefined ? {} : extra))
      }
      for (const chunk of chunks) {
        const rawLines = chunk.split('\n').map((line) => line.trim()).filter((line) => line !== '')
        if (rawLines.length === 0) continue
        let position = 0
        while (position < rawLines.length) {
          const raw = rawLines[position]
          const classified = classifyScreenplayLine(raw)
          if (classified.type === 'blank') {
            position += 1
            continue
          }
          if (classified.type === 'heading') {
            pushBlock([{ type: 'heading', text: raw.replace(HEADING_RE, '') }], { type: 'heading', headingLevel: classified.level })
            position += 1
            continue
          }
          if (classified.type === 'scene_heading' || classified.type === 'transition' || classified.type === 'note' || classified.type === 'shot' || classified.type === 'parenthetical') {
            const lineText = classified.type === 'transition' ? raw.replace(/^>\s*/, '') : raw
            pushBlock([{ type: classified.type, text: lineText }], { type: classified.type })
            position += 1
            continue
          }
          if (classified.type === 'inline_dialogue') {
            pushBlock([{ type: 'dialogue', text: raw }], { type: 'dialogue', inline: true, inlineSpeaker: `${classified.speaker}：` })
            position += 1
            continue
          }
          const nextRaw = position + 1 < rawLines.length ? rawLines[position + 1] : undefined
          const nextClassified = nextRaw === undefined ? { type: 'blank' } : classifyScreenplayLine(nextRaw)
          const cueHere = isCueCandidate(raw) || isEnglishCueCandidate(raw)
          if (cueHere && nextRaw !== undefined && nextClassified.type !== 'blank' && !isStructuralScreenplayLine(nextClassified)) {
            const lines = [{ type: 'character', text: raw }]
            position += 1
            while (position < rawLines.length) {
              const inner = rawLines[position]
              const innerClassified = classifyScreenplayLine(inner)
              if (innerClassified.type === 'parenthetical') {
                lines.push({ type: 'parenthetical', text: inner })
                position += 1
                continue
              }
              if (innerClassified.type === 'action' || innerClassified.type === 'dialogue') {
                lines.push({ type: 'dialogue', text: inner })
                position += 1
                continue
              }
              break
            }
            pushBlock(lines, { type: 'dialogue', speaker: raw })
            continue
          }
          const actionLines = []
          while (position < rawLines.length) {
            const inner = rawLines[position]
            const innerClassified = classifyScreenplayLine(inner)
            if (innerClassified.type !== 'action' && innerClassified.type !== 'shot' && innerClassified.type !== 'parenthetical') break
            actionLines.push({ type: innerClassified.type === 'shot' ? 'shot' : 'action', text: inner })
            position += 1
          }
          if (actionLines.length === 0) {
            actionLines.push({ type: 'action', text: raw })
            position += 1
          }
          pushBlock(actionLines, { type: 'action' })
        }
      }
      return blocks
    }
    // #endregion screenplay-parser

    // ── annotation anchors v2 (P0-2) ──────────────────────────────────────
    // #region screenplay-anchor
    // An annotation anchor is a versioned, content-signed address:
    //   block:   { v: 2, blockIndex, blockHash, contextSig }
    //   sentence:{ ...anchor, segments: [{ blockIndex, blockHash, contextSig, text }] }
    // contextSig hashes (previous + self + next) so a paragraph that merely moved
    // is distinguished from a different paragraph with identical text. Re-anchor
    // is conservative: index+hash+signature → hash → signature → unique quote;
    // anything ambiguous is marked stale instead of silently mis-anchored.

    function blockContextSig(blocks, index) {
      if (!Array.isArray(blocks) || index < 0 || index >= blocks.length) return ''
      const previous = index > 0 ? blocks[index - 1].text : ''
      const self = blocks[index].text
      const next = index + 1 < blocks.length ? blocks[index + 1].text : ''
      return fnv1a(`${previous}\u0000${self}\u0000${next}`)
    }

    function buildAnchor(blocks, blockIndex, level, segments) {
      if (!Array.isArray(blocks) || blockIndex < 0 || blockIndex >= blocks.length) return null
      const block = blocks[blockIndex]
      const anchor = { v: 2, blockIndex, blockHash: block.hash, contextSig: blockContextSig(blocks, blockIndex) }
      if (level === 'sentence' && Array.isArray(segments) && segments.length > 0) {
        anchor.segments = segments.map((segment) => {
          const index = segment !== null && typeof segment === 'object' && Number.isInteger(segment.blockIndex) ? segment.blockIndex : -1
          const segBlock = index >= 0 && index < blocks.length ? blocks[index] : undefined
          return {
            blockIndex: index,
            blockHash: segBlock !== undefined ? segBlock.hash : (typeof segment.blockHash === 'string' ? segment.blockHash : ''),
            contextSig: segBlock !== undefined ? blockContextSig(blocks, index) : '',
            text: typeof segment.text === 'string' ? segment.text : '',
          }
        })
      }
      return anchor
    }

    function findBlockByHash(blocks, hash) {
      if (typeof hash !== 'string' || hash === '') return null
      let found = null
      for (const block of blocks) {
        if (block.hash !== hash) continue
        if (found !== null) return null
        found = block
      }
      return found
    }

    function countBlocksByHash(blocks, hash) {
      if (typeof hash !== 'string' || hash === '') return 0
      let count = 0
      for (const block of blocks) if (block.hash === hash) count += 1
      return count
    }

    function findBlockByContext(blocks, sig, needle) {
      if (typeof sig !== 'string' || sig === '') return null
      const compactNeedle = typeof needle === 'string' ? needle.replace(/\s+/g, '').slice(0, 12) : ''
      let found = null
      for (let index = 0; index < blocks.length; index += 1) {
        if (blockContextSig(blocks, index) !== sig) continue
        if (compactNeedle !== '' && !blocks[index].text.replace(/\s+/g, '').includes(compactNeedle)) continue
        if (found !== null) return null
        found = blocks[index]
      }
      return found
    }

    function findBlockByQuote(blocks, quote) {
      const needle = typeof quote === 'string' ? quote.replace(/\s+/g, '').slice(0, 16) : ''
      if (needle === '') return null
      let found = null
      for (const block of blocks) {
        if (!block.text.replace(/\s+/g, '').includes(needle)) continue
        if (found !== null) return null
        found = block
      }
      return found
    }

    /** Resolve one annotation's block anchor against the current blocks. */
    function resolveBlockAnchor(blocks, annotation) {
      const anchor = annotation !== null && typeof annotation === 'object' && annotation.anchor !== null && typeof annotation.anchor === 'object' ? annotation.anchor : undefined
      const quote = typeof annotation.quote === 'string' ? annotation.quote : ''
      const expectedHash = anchor !== undefined && typeof anchor.blockHash === 'string' ? anchor.blockHash : annotation.blockHash
      const expectedSig = anchor !== undefined && typeof anchor.contextSig === 'string' ? anchor.contextSig : ''
      const ambiguousHash = countBlocksByHash(blocks, expectedHash) > 1
      const hintIndex = Number.isInteger(annotation.blockIndex) ? annotation.blockIndex : -1
      const hint = hintIndex >= 0 && hintIndex < blocks.length ? blocks[hintIndex] : null
      if (hint !== null) {
        // A content signature match is the strongest signal: it proves the
        // same neighbours and the same text sit at this index.
        if (expectedSig !== '' && expectedSig === blockContextSig(blocks, hintIndex)) return { block: hint, stale: false }
        // A content-hash match is acceptable only when the hash is unique.
        if (!ambiguousHash && typeof expectedHash === 'string' && expectedHash !== '' && expectedHash === hint.hash) return { block: hint, stale: false }
      }
      const byHash = findBlockByHash(blocks, expectedHash)
      if (byHash !== null) return { block: byHash, stale: false }
      const byContext = findBlockByContext(blocks, expectedSig, quote)
      if (byContext !== null) return { block: byContext, stale: false }
      const byQuote = findBlockByQuote(blocks, quote)
      if (byQuote !== null) return { block: byQuote, stale: false }
      return { block: hint, stale: true }
    }

    /** Re-resolve the per-block segments of a sentence annotation. */
    function resolveSegmentAnchors(blocks, annotation) {
      if (!Array.isArray(annotation.segments)) return null
      const anchorSegments = annotation.anchor !== null && typeof annotation.anchor === 'object' && Array.isArray(annotation.anchor.segments)
        ? annotation.anchor.segments
        : []
      let stale = false
      const segments = annotation.segments.map((segment, position) => {
        const meta = position < anchorSegments.length && anchorSegments[position] !== null && typeof anchorSegments[position] === 'object' ? anchorSegments[position] : {}
        const text = typeof segment.text === 'string' ? segment.text : (typeof meta.text === 'string' ? meta.text : '')
        const expectedHash = typeof meta.blockHash === 'string' && meta.blockHash !== '' ? meta.blockHash : segment.blockHash
        const expectedSig = typeof meta.contextSig === 'string' ? meta.contextSig : ''
        const ambiguousHash = countBlocksByHash(blocks, expectedHash) > 1
        const hintIndex = Number.isInteger(segment.blockIndex) ? segment.blockIndex : -1
        const hint = hintIndex >= 0 && hintIndex < blocks.length ? blocks[hintIndex] : null
        let block = null
        if (hint !== null) {
          if (expectedSig !== '' && expectedSig === blockContextSig(blocks, hintIndex)) block = hint
          else if (!ambiguousHash && typeof expectedHash === 'string' && expectedHash !== '' && expectedHash === hint.hash) block = hint
        }
        if (block === null) block = findBlockByHash(blocks, expectedHash)
        if (block === null && expectedSig !== '') block = findBlockByContext(blocks, expectedSig, text)
        if (block === null) {
          const needle = text.replace(/\s+/g, '').slice(0, 12)
          let found = null
          if (needle !== '') {
            for (const candidate of blocks) {
              if (!candidate.text.replace(/\s+/g, '').includes(needle)) continue
              if (found !== null) { found = null; break }
              found = candidate
            }
          }
          block = found
        }
        if (block === null) {
          stale = true
          return Object.assign({}, segment, { unmatched: true })
        }
        return Object.assign({}, segment, { blockIndex: block.index, blockHash: block.hash, unmatched: false })
      })
      return { segments, stale }
    }

    /**
     * Re-anchor every annotation against freshly parsed blocks. Pure; returns
     * the resolved annotations plus counts so the caller can toast/flag.
     */
    function reanchorAnnotations(blocks, annotations) {
      let changed = 0
      let stale = 0
      const resolved = []
      for (const annotation of annotations) {
        if (annotation === null || typeof annotation !== 'object') {
          resolved.push(annotation)
          continue
        }
        const range = resolveBlockAnchor(blocks, annotation)
        const segmentResult = resolveSegmentAnchors(blocks, annotation)
        const next = Object.assign({}, annotation)
        let localChanged = false
        if (range.block !== null && range.block.index !== annotation.blockIndex) {
          next.blockIndex = range.block.index
          localChanged = true
        }
        if (range.block !== null && range.block.hash !== annotation.blockHash) {
          next.blockHash = range.block.hash
          localChanged = true
        }
        if (segmentResult !== null) {
          next.segments = segmentResult.segments
          const before = JSON.stringify(annotation.segments)
          if (before !== JSON.stringify(segmentResult.segments)) localChanged = true
        }
        if (range.block !== null) {
          const level = annotation.level === 'sentence' ? 'sentence' : 'block'
          next.anchor = buildAnchor(blocks, range.block.index, level, segmentResult !== null ? segmentResult.segments : annotation.segments)
          if (next.anchor !== null && typeof annotation.quote === 'string') next.anchor.quote = annotation.quote
        }
        const nextStale = range.stale || (segmentResult !== null && segmentResult.stale)
        if (next.stale !== nextStale) localChanged = true
        next.stale = nextStale
        if (nextStale) {
          stale += 1
          if (next.unmatched !== true) localChanged = true
          next.unmatched = true
        } else if (next.unmatched === true) {
          next.unmatched = false
          localChanged = true
        }
        if (localChanged) changed += 1
        resolved.push(next)
      }
      return { annotations: resolved, changed, stale }
    }
    // #endregion screenplay-anchor

    // ── revision scope diff (P0-3) ────────────────────────────────────────
    // #region screenplay-diff
    // Compare the draft an annotation batch was sent against with the revision
    // the agent produced. Annotations cover base block indexes; anything the
    // agent changed outside that coverage is reported as out-of-scope.

    function alignScreenplayBlocks(baseBlocks, newBlocks) {
      const n = baseBlocks.length
      const m = newBlocks.length
      const pairs = []
      const gaps = []
      if (n * m > 4000000) {
        // Very long scripts: position-wise fallback keeps the panel responsive.
        for (let k = 0; k < Math.max(n, m); k += 1) {
          if (k < n && k < m && baseBlocks[k].hash === newBlocks[k].hash) pairs.push([k, k])
          else gaps.push({ baseGap: k < n ? [k] : [], newGap: k < m ? [k] : [], beforeBase: k - 1, afterBase: k })
        }
        return { pairs, gaps, n, m }
      }
      const baseHashes = baseBlocks.map((block) => block.hash)
      const newHashes = newBlocks.map((block) => block.hash)
      const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
      for (let i = n - 1; i >= 0; i -= 1) {
        const row = dp[i]
        const nextRow = dp[i + 1]
        const baseHash = baseHashes[i]
        for (let j = m - 1; j >= 0; j -= 1) {
          row[j] = baseHash === newHashes[j] ? nextRow[j + 1] + 1 : Math.max(nextRow[j], row[j + 1])
        }
      }
      let i = 0
      let j = 0
      let previousBase = -1
      let previousNew = -1
      const flushGap = (nextBase, nextNew) => {
        const baseGap = []
        for (let k = previousBase + 1; k < nextBase; k += 1) baseGap.push(k)
        const newGap = []
        for (let k = previousNew + 1; k < nextNew; k += 1) newGap.push(k)
        if (baseGap.length > 0 || newGap.length > 0) gaps.push({ baseGap, newGap, beforeBase: previousBase, afterBase: nextBase < n ? nextBase : null })
      }
      while (i < n && j < m) {
        if (baseHashes[i] === newHashes[j]) {
          flushGap(i, j)
          pairs.push([i, j])
          previousBase = i
          previousNew = j
          i += 1
          j += 1
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
          i += 1
        } else {
          j += 1
        }
      }
      flushGap(n, m)
      return { pairs, gaps, n, m }
    }

    function annotationCoverage(annotations) {
      const coverage = new Map()
      const add = (index, tag, note) => {
        if (!Number.isInteger(index) || index < 0) return
        if (!coverage.has(index)) coverage.set(index, [])
        coverage.get(index).push({ tag: typeof tag === 'string' ? tag : '', note: typeof note === 'string' ? note : '' })
      }
      for (const annotation of annotations === undefined || annotations === null ? [] : annotations) {
        if (annotation === null || typeof annotation !== 'object') continue
        const tag = typeof annotation.tag === 'string' ? annotation.tag : ''
        const note = typeof annotation.note === 'string' ? annotation.note : ''
        if (annotation.level === 'sentence' && Array.isArray(annotation.segments)) {
          for (const segment of annotation.segments) {
            if (segment !== null && typeof segment === 'object') add(segment.blockIndex, tag, note)
          }
        } else {
          add(annotation.blockIndex, tag, note)
        }
      }
      return coverage
    }

    /**
     * Evaluate one revision against the annotation coverage of its base draft.
     * Returns out-of-scope changes (modified / inserted / deleted paragraphs)
     * plus the in-scope change count.
     */
    function evaluateRevisionScope(baseBlocks, newBlocks, annotations) {
      const alignment = alignScreenplayBlocks(baseBlocks, newBlocks)
      const coverage = annotationCoverage(annotations)
      const covered = (index) => coverage.has(index)
      const entriesOf = (index) => coverage.get(index) || []
      const tagged = (index, tag) => entriesOf(index).some((entry) => entry.tag === tag)
      // Honor intent independent of the tag: a note that asks to delete or add
      // is a legitimate scope change even when the user picked 改写.
      const allowsDelete = (index) => entriesOf(index).some((entry) => entry.tag === '删戏' || /删/.test(entry.note))
      const allowsInsert = (index) => entriesOf(index).some((entry) => entry.tag === '加戏' || /[加增补]/.test(entry.note))
      const outOfScope = []
      let inScope = 0
      for (const gap of alignment.gaps) {
        const baseGap = gap.baseGap
        const newGap = gap.newGap
        const paired = Math.min(baseGap.length, newGap.length)
        for (let k = 0; k < paired; k += 1) {
          const baseIndex = baseGap[k]
          if (covered(baseIndex) || allowsDelete(baseIndex)) {
            inScope += 1
            continue
          }
          outOfScope.push({ kind: 'modified', baseIndex, before: baseBlocks[baseIndex].text, after: newBlocks[newGap[k]].text })
        }
        if (baseGap.length > newGap.length) {
          for (let k = paired; k < baseGap.length; k += 1) {
            const baseIndex = baseGap[k]
            if (allowsDelete(baseIndex)) {
              inScope += 1
              continue
            }
            outOfScope.push({ kind: 'deleted', baseIndex, before: baseBlocks[baseIndex].text })
          }
        } else if (newGap.length > baseGap.length) {
          const insertionAllowed = (gap.beforeBase !== null && allowsInsert(gap.beforeBase))
            || (gap.afterBase !== null && allowsInsert(gap.afterBase))
          for (let k = paired; k < newGap.length; k += 1) {
            if (insertionAllowed) {
              inScope += 1
              continue
            }
            outOfScope.push({ kind: 'inserted', after: newBlocks[newGap[k]].text })
          }
        }
      }
      return {
        outOfScope,
        inScope,
        baseCount: alignment.n,
        newCount: alignment.m,
        modified: outOfScope.filter((change) => change.kind === 'modified').length,
        inserted: outOfScope.filter((change) => change.kind === 'inserted').length,
        deleted: outOfScope.filter((change) => change.kind === 'deleted').length,
      }
    }
    // #endregion screenplay-diff

    function splitBlocks(text) {
      return parseScreenplay(text)
    }

    /** CSS class for one typed screenplay line. */
    function screenplayLineClass(type) {
      switch (type) {
        case 'heading': return 'spm-line spm-line-heading'
        case 'scene_heading': return 'spm-line spm-line-scene'
        case 'transition': return 'spm-line spm-line-transition'
        case 'shot': return 'spm-line spm-line-shot'
        case 'note': return 'spm-line spm-line-note'
        case 'character': return 'spm-line spm-line-character'
        case 'parenthetical': return 'spm-line spm-line-paren'
        case 'dialogue': return 'spm-line spm-line-dialogue'
        default: return 'spm-line'
      }
    }

    /** Locate a stored quote inside a block's text (exact, then whitespace-insensitive). */
    function findQuoteRange(blockText, quote) {
      if (typeof quote !== 'string') return null
      const needle = quote.replace(/…$/, '').trim()
      if (needle === '') return null
      const direct = blockText.indexOf(needle)
      if (direct !== -1) return { start: direct, end: direct + needle.length }
      const chars = []
      let previousSpace = false
      for (let index = 0; index < blockText.length; index += 1) {
        const char = blockText[index]
        if (/\s/.test(char)) {
          if (!previousSpace) {
            chars.push({ char: ' ', index })
            previousSpace = true
          }
        } else {
          chars.push({ char, index })
          previousSpace = false
        }
      }
      const normalized = chars.map((entry) => entry.char).join('')
      const at = normalized.indexOf(needle)
      if (at !== -1 && chars[at + needle.length - 1] !== undefined) {
        return { start: chars[at].index, end: chars[at + needle.length - 1].index + 1 }
      }
      // Last resort: ignore whitespace entirely (a selection of wrapped DOM lines
      // can concatenate without the source newline).
      const compactChars = []
      for (let index = 0; index < blockText.length; index += 1) {
        const char = blockText[index]
        if (!/\s/.test(char)) compactChars.push({ char, index })
      }
      const compact = compactChars.map((entry) => entry.char).join('')
      const needleCompact = needle.replace(/\s+/g, '')
      const compactAt = compact.indexOf(needleCompact)
      if (compactAt === -1 || compactChars[compactAt + needleCompact.length - 1] === undefined) return null
      return { start: compactChars[compactAt].index, end: compactChars[compactAt + needleCompact.length - 1].index + 1 }
    }

    /** Union overlapping highlight ranges, keeping the strongest (active) flag. */
    function mergeHighlightRanges(ranges) {
      const sorted = ranges
        .filter((range) => range !== null && range !== undefined && range.end > range.start)
        .sort((left, right) => left.start - right.start)
      const merged = []
      for (const range of sorted) {
        const last = merged[merged.length - 1]
        if (last !== undefined && range.start <= last.end) {
          last.end = Math.max(last.end, range.end)
          last.active = last.active === true || range.active === true
        } else {
          merged.push({ start: range.start, end: range.end, active: range.active === true })
        }
      }
      return merged
    }

    /** Map a stored quote to per-block ranges by matching it against the whole
     *  script text (line breaks between blocks are whitespace-insensitive). */
    function planQuoteHighlights(blocks, quote) {
      const planned = new Map()
      if (typeof quote !== 'string' || quote.trim() === '') return planned
      let full = ''
      const spans = []
      for (const block of blocks) {
        spans.push({ index: block.index, start: full.length, end: full.length + block.text.length })
        full += `${block.text}\n`
      }
      const range = findQuoteRange(full, quote)
      if (range === null) return planned
      for (const span of spans) {
        const start = Math.max(range.start, span.start)
        const end = Math.min(range.end, span.end)
        if (start < end) planned.set(span.index, { start: start - span.start, end: end - span.start })
      }
      return planned
    }

    /** Every sentence highlight of one render, keyed by block index. */
    function buildHighlightPlans(blocks, allAnnotations, editing) {
      const plans = new Map()
      const addPlan = (plan, active) => {
        for (const entry of plan) {
          const blockIndex = entry[0]
          const range = entry[1]
          if (!plans.has(blockIndex)) plans.set(blockIndex, [])
          plans.get(blockIndex).push({ start: range.start, end: range.end, active: active === true })
        }
      }
      for (const annotation of allAnnotations) {
        if (annotation === null || typeof annotation !== 'object' || annotation.level !== 'sentence') continue
        addPlan(planQuoteHighlights(blocks, annotation.quote), editing !== null && editing.id === annotation.id)
      }
      if (editing !== null && typeof editing === 'object' && editing.level === 'sentence') {
        addPlan(planQuoteHighlights(blocks, editing.quote), true)
      }
      return plans
    }

    /** Split one rendered line into plain and highlighted pieces at the given ranges. */
    function lineSegments(display, lineStart, ranges) {
      const pieces = []
      const lineEnd = lineStart + display.length
      let cursor = 0
      for (const range of ranges) {
        const start = Math.max(range.start, lineStart)
        const end = Math.min(range.end, lineEnd)
        if (start >= end) continue
        const localStart = start - lineStart
        const localEnd = end - lineStart
        if (localStart > cursor) pieces.push({ text: display.slice(cursor, localStart), start: lineStart + cursor, highlight: false, active: false })
        pieces.push({ text: display.slice(localStart, localEnd), start, highlight: true, active: range.active === true })
        cursor = localEnd
      }
      if (cursor < display.length) pieces.push({ text: display.slice(cursor), start: lineStart + cursor, highlight: false, active: false })
      if (pieces.length === 0) pieces.push({ text: display, start: lineStart, highlight: false, active: false })
      return pieces
    }

    function diffLines(beforeText, afterText) {
      const before = String(beforeText).replace(/\r\n/g, '\n').split('\n')
      const after = String(afterText).replace(/\r\n/g, '\n').split('\n')
      if (before.length * after.length > 2500000) {
        return [
          ...before.map((text) => ({ type: 'del', text })),
          ...after.map((text) => ({ type: 'add', text })),
        ]
      }
      const rows = before.length
      const cols = after.length
      const table = Array.from({ length: rows + 1 }, () => new Int32Array(cols + 1))
      for (let i = rows - 1; i >= 0; i -= 1) {
        for (let j = cols - 1; j >= 0; j -= 1) {
          table[i][j] = before[i] === after[j]
            ? table[i + 1][j + 1] + 1
            : Math.max(table[i + 1][j], table[i][j + 1])
        }
      }
      const output = []
      let i = 0
      let j = 0
      while (i < rows && j < cols) {
        if (before[i] === after[j]) {
          output.push({ type: 'same', text: before[i] })
          i += 1
          j += 1
        } else if (table[i + 1][j] >= table[i][j + 1]) {
          output.push({ type: 'del', text: before[i] })
          i += 1
        } else {
          output.push({ type: 'add', text: after[j] })
          j += 1
        }
      }
      while (i < rows) {
        output.push({ type: 'del', text: before[i] })
        i += 1
      }
      while (j < cols) {
        output.push({ type: 'add', text: after[j] })
        j += 1
      }
      return output
    }

    function b64urlEncode(text) {
      const bytes = new TextEncoder().encode(text)
      let binary = ''
      const chunk = 0x8000
      for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk))
      }
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
    }

    function messageOf(error) {
      if (error !== null && typeof error === 'object' && typeof error.message === 'string') return error.message
      return String(error)
    }

    function parseExecution(result) {
      if (result === null || typeof result !== 'object' || result.ok !== true) {
        const error = result !== null && typeof result === 'object' && result.error !== undefined ? result.error : {}
        return { ok: false, code: typeof error.code === 'string' ? error.code : 'E_REMOTE', text: typeof error.message === 'string' ? error.message : '命令执行失败' }
      }
      const execution = result.value
      if (execution === undefined || execution === null) {
        return { ok: false, code: 'E_UNKNOWN', text: '命令未注册（/screenplay）' }
      }
      const outcome = execution.result
      if (outcome === null || typeof outcome !== 'object') return { ok: false, code: 'E_COMMAND', text: '命令没有返回结果' }
      const text = typeof outcome.text === 'string' ? outcome.text : ''
      if (outcome.kind === 'error') {
        const match = /^ERR ([A-Z0-9_]+):\s*([\s\S]*)$/.exec(text)
        return { ok: false, code: match ? match[1] : 'E_COMMAND', text: match ? match[2] : text }
      }
      const match = /^OK ([\s\S]*)$/.exec(text)
      if (match === null) return { ok: true, value: {} }
      try {
        return { ok: true, value: JSON.parse(match[1]) }
      } catch {
        return { ok: true, value: {} }
      }
    }

    function formatTime(iso) {
      const time = Date.parse(iso)
      if (!Number.isFinite(time)) return ''
      try {
        return new Date(time).toLocaleString()
      } catch {
        return iso
      }
    }

    // ── draft persistence ──────────────────────────────────────────────────

    const draftKey = (sessionId, docPath) => `dsh.screenplay.draft.v1:${sessionId}:${docPath}`

    function loadDraft(sessionId, docPath) {
      try {
        const raw = window.localStorage.getItem(draftKey(sessionId, docPath))
        if (raw === null) return null
        const parsed = JSON.parse(raw)
        return parsed !== null && typeof parsed === 'object' ? parsed : null
      } catch {
        return null
      }
    }

    function saveDraft(sessionId, docPath, draft) {
      try {
        window.localStorage.setItem(draftKey(sessionId, docPath), JSON.stringify(draft))
      } catch {
        /* quota or private mode: drafts stay in memory */
      }
    }

    function clearDraft(sessionId, docPath) {
      try {
        window.localStorage.removeItem(draftKey(sessionId, docPath))
      } catch {
        /* ignore */
      }
    }

    // ── typography preference ──────────────────────────────────────────────

    const TYPOGRAPHY_KEY = 'dsh.screenplay.typography.v1'
    const TYPOGRAPHY_DEFAULTS = { lineHeight: 1.85, blockGap: 10, fontSize: 13.5 }

    function normalizeTypography(value) {
      const source = value !== null && typeof value === 'object' ? value : {}
      const lineHeight = Number(source.lineHeight)
      const blockGap = Number(source.blockGap)
      const fontSize = Number(source.fontSize)
      return {
        lineHeight: Number.isFinite(lineHeight) ? Math.min(2.4, Math.max(1.3, lineHeight)) : TYPOGRAPHY_DEFAULTS.lineHeight,
        blockGap: Number.isFinite(blockGap) ? Math.min(60, Math.max(0, blockGap)) : TYPOGRAPHY_DEFAULTS.blockGap,
        fontSize: Number.isFinite(fontSize) ? Math.min(20, Math.max(11, fontSize)) : TYPOGRAPHY_DEFAULTS.fontSize,
      }
    }

    function loadTypography() {
      try {
        const raw = window.localStorage.getItem(TYPOGRAPHY_KEY)
        return raw === null ? TYPOGRAPHY_DEFAULTS : normalizeTypography(JSON.parse(raw))
      } catch {
        return TYPOGRAPHY_DEFAULTS
      }
    }

    function saveTypography(value) {
      try {
        window.localStorage.setItem(TYPOGRAPHY_KEY, JSON.stringify(normalizeTypography(value)))
      } catch {
        /* keep the in-memory preference */
      }
    }

    function truncateText(value, max) {
      const text = String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim()
      return text.length <= max ? text : `${text.slice(0, max)}…`
    }

    // ── styles ─────────────────────────────────────────────────────────────

    const CSS = `
.spm-root{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;color:var(--dsw-alias-label-primary);font:inherit;background:transparent}
.spm-head{display:flex;align-items:center;gap:6px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none}
.spm-title{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1 1 auto;min-width:0}
.spm-badge{font-size:11px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:1px 8px;white-space:nowrap;flex:none}
.spm-badge-warn{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}
.spm-btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:4px 10px;font:inherit;font-size:12px;line-height:18px;cursor:pointer;white-space:nowrap}
.spm-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.spm-btn:disabled{opacity:.45;cursor:default}
.spm-btn-ghost{border-color:transparent;background:transparent;color:var(--dsw-alias-label-secondary)}
.spm-btn-primary{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-bg-base)}
.spm-btn-primary:hover:not(:disabled){filter:brightness(1.06);background:var(--dsw-alias-brand-primary)}
.spm-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-border-l1)}
.spm-tool{width:24px;height:24px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1;cursor:pointer;flex:none}
.spm-tool:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.spm-banner{display:flex;align-items:center;gap:8px;margin:8px 12px 0;padding:8px 10px;border:1px solid var(--dsw-alias-state-warn-primary);border-radius:8px;color:var(--dsw-alias-state-warn-primary);font-size:12px;flex:none}
.spm-banner-text{flex:1 1 auto;min-width:0}
.spm-body{flex:1 1 auto;overflow:auto;min-height:0;padding:10px 12px 24px}
.spm-foot{display:flex;align-items:center;gap:8px;justify-content:flex-end;padding:8px 12px;border-top:1px solid var(--dsw-alias-border-l1);flex:none}
.spm-foot-count{flex:1 1 auto;min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spm-block{position:relative;padding:2px 8px 2px 10px;border-left:2px solid transparent;border-radius:4px;margin-bottom:var(--spm-block-gap,10px)}
.spm-block:hover{background:var(--dsw-alias-bg-layer-1)}
.spm-block-annotated{border-left-color:var(--dsw-alias-brand-primary)}
.spm-block-scene{margin-top:16px}
.spm-block-act{margin-top:24px}
.spm-block-flash{animation:spm-flash 1.8s ease-out}
.spm-block-edit-range{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 7%, transparent);border-left-color:color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent)}
.spm-block-edit-range-first{border-top-left-radius:6px;border-top-right-radius:6px;padding-top:5px;margin-top:4px}
.spm-block-edit-range-last{border-bottom-left-radius:6px;border-bottom-right-radius:6px;padding-bottom:5px;margin-bottom:6px}
.spm-edit-group{position:relative;margin:6px 0 10px;padding:4px 8px 8px;background:color-mix(in srgb, var(--dsw-alias-brand-primary) 7%, transparent);border:1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 28%, transparent);border-left:3px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);border-radius:10px}
.spm-group-label{position:absolute;top:-1px;right:12px;transform:translateY(-60%);font-size:10px;line-height:1;padding:3px 7px;border-radius:999px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);pointer-events:none;white-space:nowrap}
.spm-edit-group .spm-editor{margin:8px 0 2px}
.spm-annotation-group{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 4%, transparent);border-color:color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent);border-left-width:2px}
@keyframes spm-flash{0%{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 24%, transparent)}70%{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent)}100%{background:transparent}}
.spm-backtop{position:absolute;right:14px;bottom:60px;z-index:7;width:32px;height:32px;border-radius:50%;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);cursor:pointer;font-size:14px;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.18)}
.spm-backtop:hover{background:var(--dsw-alias-bg-layer-2)}
.spm-gutter{position:absolute;top:2px;right:2px;width:24px;height:24px;padding:0;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:14px;line-height:20px;cursor:pointer;opacity:0}
.spm-block:hover .spm-gutter{opacity:1}
.spm-gutter:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.spm-line{white-space:pre-wrap;word-break:break-word;font-size:var(--spm-font-size,13.5px);line-height:var(--spm-line-height,1.85);min-height:1.2em}
.spm-line-heading{font-weight:600;font-size:calc(var(--spm-font-size,13.5px) + 1px);margin-top:4px}
.spm-line-scene{font-weight:600;letter-spacing:.02em;margin-top:4px}
.spm-line-act{font-weight:600;font-size:calc(var(--spm-font-size,13.5px) + 1px);margin-top:4px}
.spm-line-dialogue{padding-left:1.1em}
.spm-line-transition{text-align:right;font-style:italic;color:var(--dsw-alias-label-secondary)}
.spm-line-shot{color:var(--dsw-alias-label-secondary)}
.spm-line-note{font-style:italic;color:var(--dsw-alias-label-secondary);border-left:2px solid var(--dsw-alias-border-l2);padding-left:6px}
.spm-line-character{font-weight:600;margin-top:4px}
.spm-line-paren{font-style:italic;color:var(--dsw-alias-label-secondary);padding-left:2.2em}
.spm-speaker{font-weight:600;color:var(--dsw-alias-label-primary)}
.spm-line-quote{padding-left:2px}
.spm-hl{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 20%, transparent);color:inherit;border-radius:2px}
.spm-hl-active{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 34%, transparent)}
.spm-notes{margin:6px 0 2px 2px;display:flex;flex-direction:column;gap:6px}
.spm-note{border:1px solid var(--dsw-alias-border-l1);border-left:3px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-1);border-radius:8px;padding:8px 10px;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary)}
.spm-note-head{display:flex;align-items:center;gap:6px;margin-bottom:4px;min-width:0}
.spm-note-tag{font-size:11px;color:var(--dsw-alias-brand-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:0 7px;flex:none}
.spm-note-quote{font-size:11px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1 1 auto;opacity:.9}
.spm-note-actions{margin-left:auto;display:flex;gap:2px;flex:none}
.spm-icon-btn{border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:12px;padding:1px 4px;border-radius:4px}
.spm-icon-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.spm-editor{margin:6px 0 10px 2px;display:flex;flex-direction:column;gap:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px;background:var(--dsw-alias-bg-layer-1)}
.spm-editor-quote{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);border-left:2px solid var(--dsw-alias-brand-primary);background:color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent);border-radius:4px;padding:3px 8px;max-height:4.8em;overflow:auto;white-space:pre-wrap;word-break:break-word}
.spm-textarea{width:100%;min-height:60px;resize:vertical;box-sizing:border-box;background:transparent;color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:6px;font:inherit;font-size:12px;line-height:1.5}
.spm-editor-row{display:flex;align-items:center;gap:8px}
.spm-select{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:2px 6px;font:inherit;font-size:12px}
.spm-empty{padding:24px 12px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.7}
.spm-empty-actions{margin-top:10px;display:flex;gap:8px;justify-content:center}
.spm-toast{position:absolute;left:12px;right:12px;bottom:52px;z-index:6;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 10px;font-size:12px;line-height:1.5;box-shadow:0 6px 20px rgba(0,0,0,.18)}
.spm-sel-bubble{position:absolute;z-index:8;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;line-height:20px;padding:2px 10px;cursor:pointer;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,.18)}
.spm-sel-bubble:hover{background:var(--dsw-alias-bg-layer-2)}
.spm-overlay{position:absolute;inset:0;z-index:10;background:rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box}
.spm-dialog{width:min(100%,440px);max-height:100%;display:flex;flex-direction:column;min-height:0;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:12px;box-sizing:border-box;box-shadow:0 12px 40px rgba(0,0,0,.24)}
.spm-dialog-head{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex:none}
.spm-dialog-title{font-size:13px;font-weight:600;flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spm-dialog-body{overflow:auto;min-height:0;flex:1 1 auto}
.spm-version-row{display:flex;align-items:center;gap:8px;padding:8px 6px;border-bottom:1px solid var(--dsw-alias-border-l1);cursor:pointer}
.spm-version-row:hover{background:var(--dsw-alias-bg-layer-1)}
.spm-version-seq{font-size:12px;font-weight:600;min-width:34px}
.spm-version-meta{flex:1 1 auto;min-width:0;font-size:11px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spm-preview-head{display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap}
.spm-pre{margin:0;padding:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;max-height:46vh;overflow:auto}
.spm-diff-line{padding:0 6px;font-size:12px;line-height:1.55;white-space:pre-wrap;word-break:break-word}
.spm-diff-add{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 16%, transparent);color:var(--dsw-alias-state-success-primary)}
.spm-diff-del{background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 14%, transparent);color:var(--dsw-alias-state-error-primary);text-decoration:line-through}
.spm-diff-same{color:var(--dsw-alias-label-secondary)}
.spm-toc-row{padding:7px 8px;border-radius:6px;cursor:pointer;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spm-toc-row:hover{background:var(--dsw-alias-bg-layer-1)}
.spm-toc-level1{font-weight:600}
.spm-toc-level2{padding-left:24px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.spm-typography-row{display:flex;align-items:center;gap:10px;margin:12px 0}
.spm-typography-label{font-size:12px;color:var(--dsw-alias-label-secondary);flex:none;width:88px}
.spm-range{flex:1 1 auto;min-width:0;accent-color:var(--dsw-alias-brand-primary)}
.spm-value{font-size:11px;color:var(--dsw-alias-label-secondary);min-width:42px;text-align:right;flex:none;font-variant-numeric:tabular-nums}
.spm-report-list{display:flex;flex-direction:column;gap:8px;max-height:340px;overflow:auto}
.spm-report-row{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px 10px;background:var(--dsw-alias-bg-layer-2)}
.spm-report-kind{font-size:11px;font-weight:600;color:var(--dsw-alias-state-warn-primary);margin-bottom:4px}
.spm-report-before,.spm-report-after{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word}
.spm-report-after{color:var(--dsw-alias-label-primary)}
.spm-typo-hint{font-size:11px;line-height:1.6;color:var(--dsw-alias-label-secondary);margin:0 0 8px}
.spm-typo-preview{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px 10px;background:var(--dsw-alias-bg-base);max-height:210px;overflow:auto;margin-bottom:4px}
.spm-typo-preview .spm-block{margin-bottom:var(--spm-block-gap,10px)}
.spm-typo-preview .spm-block:last-child{margin-bottom:0}
.spm-workbench{display:flex;flex-direction:column;gap:8px;height:100%;min-height:0}
.spm-file-row{display:flex;align-items:center;gap:8px;padding:9px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);cursor:pointer}
.spm-file-row:hover{background:var(--dsw-alias-bg-layer-2)}
.spm-file-name{flex:1 1 auto;min-width:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.spm-hint{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);padding:0 2px}
`
    function ensureStyle() {
      if (typeof document === 'undefined') return () => {}
      const cssId = `${PACKAGE_ID}/panel.css`
      if (document.querySelector(`style[data-plugin-css="${cssId}"]`) !== null) return () => {}
      const tag = document.createElement('style')
      tag.dataset.plugin = PACKAGE_ID
      tag.dataset.pluginCss = cssId
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => {
        tag.remove()
      }
    }

    // ── remote helpers (created in apply, so they capture the client ctx) ──

    function createRemoteHelpers(ctx) {
      async function readWholeText(sessionId, path, signal) {
        let offset = 1
        let text = ''
        let version = null
        let absolutePath = null
        for (let page = 0; page < 12; page += 1) {
          const result = await ctx.remote.workspaceFiles.read(sessionId, path, { offset, limit: 5000 }, signal)
          if (result === null || typeof result !== 'object' || result.ok !== true) {
            const error = result !== null && typeof result === 'object' && result.error !== undefined ? result.error : {}
            throw Object.assign(new Error(typeof error.message === 'string' ? error.message : '读取文件失败'), {
              code: typeof error.code === 'string' ? error.code : 'E_REMOTE',
            })
          }
          const value = result.value
          if (value === null || typeof value !== 'object') throw new Error('读取文件返回为空')
          version = value.version ?? version
          absolutePath = value.absolutePath ?? absolutePath
          text = text === '' ? String(value.text ?? '') : `${text}\n${String(value.text ?? '')}`
          if (value.eof === true) return { text, version, absolutePath }
          const lines = Number.isInteger(value.lines) ? value.lines : 0
          if (lines <= 0) return { text, version, absolutePath }
          offset += lines
        }
        throw new Error('文件过长，暂不支持在面板中打开（超过 60000 行）')
      }

      async function readScriptList(sessionId, signal) {
        const result = await ctx.remote.workspaceFiles.list(sessionId, SCRIPT_DIR, signal)
        if (result === null || typeof result !== 'object' || result.ok !== true) {
          const error = result !== null && typeof result === 'object' && result.error !== undefined ? result.error : {}
          const code = typeof error.code === 'string' ? error.code : ''
          if (code === 'workspace-file/not-found' || code === 'workspace-file/not-directory') {
            return { available: false, entries: [] }
          }
          throw new Error(typeof error.message === 'string' ? error.message : '读取剧本目录失败')
        }
        const listing = result.value
        const entries = Array.isArray(listing?.entries) ? listing.entries : []
        return {
          available: true,
          entries: entries
            .filter((entry) => entry !== null && typeof entry === 'object' && entry.type === 'file' && DOC_EXT.test(String(entry.name ?? '')))
            .map((entry) => ({ name: String(entry.name) })),
        }
      }

      return {
        readDoc: (sessionId, path, signal) => readWholeText(sessionId, path, signal),
        readSidecar: (sessionId, path, signal) => readWholeText(sessionId, path, signal),
        statDoc: (sessionId, path, signal) => ctx.remote.workspaceFiles.stat(sessionId, path, signal),
        listScripts: (sessionId, signal) => readScriptList(sessionId, signal),
        runCommand: (sessionId, line) => ctx.remote.commands.execute(sessionId, line, []),
      }
    }

    // ── panel: root ────────────────────────────────────────────────────────

    function ScreenplayPanel(props) {
      const info = props.useTabInfo()
      const tab = info.tab
      const file = parseFileAddress(tab.contentId)
      if (file !== null && isScriptPath(file.path)) {
        return h(DocView, Object.assign({}, props, { tab: tab, file: file }))
      }
      return h(Workbench, Object.assign({}, props, { tab: tab }))
    }

    // ── panel: workbench (page tab without a document) ─────────────────────

    function Workbench(props) {
      const { tab, sessionId, listScripts, runCommand, t } = props
      const tr = (key, params) => {
        const raw = t(key)
        if (params === undefined) return raw
        return String(raw).replace(/\{(\w+)\}/g, (match, name) => (params[name] === undefined ? match : String(params[name])))
      }
      const [state, setState] = useState({ status: 'loading', available: true, entries: [], error: '' })
      const [busy, setBusy] = useState(false)
      const mounted = useRef(true)
      const io = useRef(props)
      io.current = props

      const refresh = useCallback(async (signal) => {
        try {
          const listing = await io.current.listScripts(signal)
          if (signal !== undefined && signal.aborted) return
          if (mounted.current) setState({ status: 'ready', available: listing.available, entries: listing.entries, error: '' })
        } catch (error) {
          if (signal !== undefined && signal.aborted) return
          if (mounted.current) setState({ status: 'error', available: false, entries: [], error: messageOf(error) })
        }
      }, [])

      useEffect(() => {
        mounted.current = true
        const controller = new AbortController()
        void refresh(controller.signal)
        return () => {
          mounted.current = false
          controller.abort()
        }
      }, [refresh])

      const openScript = (name) => {
        const address = sessionFileAddress(sessionId, `${SCRIPT_DIR}/${name}`)
        tab.actions.openResource(address, { replaceTab: true })
      }

      const createTemplate = async () => {
        setBusy(true)
        try {
          const result = await runCommand('/screenplay init')
          const parsed = parseExecution(result)
          if (!parsed.ok) setState((prev) => Object.assign({}, prev, { status: 'error', error: parsed.text }))
          else await refresh(new AbortController().signal)
        } catch (error) {
          setState((prev) => Object.assign({}, prev, { status: 'error', error: messageOf(error) }))
        } finally {
          setBusy(false)
        }
      }

      const content = state.status === 'loading'
        ? h('div', { className: 'spm-empty' }, tr('workbench.loading'))
        : state.status === 'error'
          ? h('div', { className: 'spm-empty' }, tr('workbench.error', { msg: state.error }))
          : state.entries.length === 0
            ? h('div', { className: 'spm-empty' },
                h('div', null, state.available ? tr('workbench.empty') : SCRIPT_DIR + '/'),
                h('div', { className: 'spm-empty-actions' },
                  h('button', { type: 'button', className: 'spm-btn', onClick: () => void refresh(new AbortController().signal) }, tr('workbench.refresh')),
                  h('button', { type: 'button', className: 'spm-btn spm-btn-primary', disabled: busy, onClick: () => void createTemplate() }, tr('workbench.init')),
                ),
              )
            : state.entries.map((entry) => h('div', {
                key: entry.name,
                className: 'spm-file-row',
                role: 'button',
                tabIndex: 0,
                onClick: () => openScript(entry.name),
                onKeyDown: (event) => {
                  if (event.key === 'Enter' || event.key === ' ') openScript(entry.name)
                },
              },
                h('span', { className: 'spm-file-name' }, entry.name),
                h('span', { className: 'spm-badge' }, tr('workbench.open')),
              ))

      return h('div', { className: 'spm-root' },
        h('div', { className: 'spm-head' },
          h('div', { className: 'spm-title' }, tr('workbench.title')),
          h('button', { type: 'button', className: 'spm-btn spm-btn-ghost', onClick: () => void refresh(new AbortController().signal) }, tr('workbench.refresh')),
        ),
        h('div', { className: 'spm-body' },
          h('div', { className: 'spm-hint' }, tr('workbench.hint')),
          h('div', { style: { height: '8px' } }),
          content,
        ),
      )
    }

    // ── panel: document / annotation view ──────────────────────────────────

    function DocView(props) {
      const { tab, file, sessionId, t } = props
      const docPath = file.path
      const io = useRef(props)
      io.current = props
      const tRef = useRef(t)
      tRef.current = t
      const tr = useCallback((key, params) => {
        const raw = tRef.current(key)
        if (params === undefined) return raw
        return String(raw).replace(/\{(\w+)\}/g, (match, name) => (params[name] === undefined ? match : String(params[name])))
      }, [])

      const [doc, setDoc] = useState({ status: 'loading', text: '', version: null, error: '' })
      const [index, setIndex] = useState({ status: 'loading', data: null, error: '' })
      const [annotations, setAnnotations] = useState([])
      const [baseVersion, setBaseVersion] = useState(null)
      const [editing, setEditing] = useState(null)
      const [sending, setSending] = useState(false)
      const [pending, setPending] = useState(null)
      const [toast, setToast] = useState('')
      const [versionsOpen, setVersionsOpen] = useState(false)
      const [staleOpen, setStaleOpen] = useState(false)
      const [tocOpen, setTocOpen] = useState(false)
      const [typographyOpen, setTypographyOpen] = useState(false)
      const [typography, setTypography] = useState(loadTypography)
      const [bubble, setBubble] = useState(null)
      const [flash, setFlash] = useState(null)
      const [showBackToTop, setShowBackToTop] = useState(false)
      const [hydratedFor, setHydratedFor] = useState('')
      const [preview, setPreview] = useState(null)
      const [revisionReport, setRevisionReport] = useState(null)
      const [reportOpen, setReportOpen] = useState(false)

      const live = useRef({})
      live.current = { doc, annotations, baseVersion, pending, hydratedFor }
      const toastTimer = useRef(undefined)
      const flashTimer = useRef(undefined)
      const savedSelectionRef = useRef(null)
      const reanchoredForRef = useRef('')
      const rootRef = useRef(null)
      const bodyRef = useRef(null)

      const showToast = useCallback((text) => {
        setToast(text)
        if (toastTimer.current !== undefined) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(''), 4200)
      }, [])

      useEffect(() => () => {
        if (toastTimer.current !== undefined) clearTimeout(toastTimer.current)
        if (flashTimer.current !== undefined) clearTimeout(flashTimer.current)
      }, [])

      // A new document starts at the top with no transient highlight.
      useEffect(() => {
        setFlash(null)
        setShowBackToTop(false)
        setRevisionReport(null)
        setReportOpen(false)
        const body = bodyRef.current
        if (body !== null && typeof body.scrollTo === 'function') body.scrollTo({ top: 0 })
      }, [docPath])

      useEffect(() => {
        saveTypography(typography)
      }, [typography])

      // Keep the browser's native selection visible while a sentence editor is
      // open: record the selection as block-local character offsets, then rebuild
      // it after the editor renders. Offsets survive text-node splitting by
      // inline highlight marks, and they cover a selection spanning any number
      // of blocks (the editor also shows the quoted text).
      const editingBlockIndex = editing === null ? null : editing.blockIndex
      const editingQuote = editing === null ? null : editing.quote
      const editingLevel = editing === null ? null : editing.level

      const blockElementFor = (node) => {
        if (node === null || node === undefined) return null
        const element = node.nodeType === 1 ? node : node.parentElement
        if (element === null || element === undefined || typeof element.closest !== 'function') return null
        return element.closest('[data-spm-block]')
      }

      const offsetWithinBlock = (blockElement, node, offset) => {
        try {
          const probe = document.createRange()
          probe.selectNodeContents(blockElement)
          probe.setEnd(node, offset)
          return probe.toString().length
        } catch {
          return null
        }
      }

      const restoreNativeSelection = (saved) => {
        const root = rootRef.current
        if (root === null || saved === null || saved === undefined) return
        const startElement = root.querySelector(`[data-spm-block="${saved.startBlockIndex}"]`)
        const endElement = root.querySelector(`[data-spm-block="${saved.endBlockIndex}"]`)
        if (startElement === null || endElement === null) return
        const locate = (element, targetOffset) => {
          const walker = document.createTreeWalker(element, 4)
          let remaining = targetOffset
          let node = walker.nextNode()
          while (node !== null) {
            const length = node.nodeValue === null ? 0 : node.nodeValue.length
            if (remaining <= length) return { node, offset: remaining }
            remaining -= length
            node = walker.nextNode()
          }
          return null
        }
        const start = locate(startElement, saved.startOffset)
        const end = locate(endElement, saved.endOffset)
        if (start === null || end === null) return
        const range = document.createRange()
        range.setStart(start.node, start.offset)
        range.setEnd(end.node, end.offset)
        const selection = window.getSelection()
        if (selection !== null) {
          selection.removeAllRanges()
          selection.addRange(range)
        }
      }

      useEffect(() => {
        if (editingLevel !== 'sentence') return
        const saved = savedSelectionRef.current
        if (saved === null) return
        try {
          restoreNativeSelection(saved)
        } catch {
          /* offsets may no longer resolve after a content update */
        }
      }, [editingBlockIndex, editingLevel, editingQuote])

      const applyLoadedDoc = useCallback((loaded) => {
        setDoc({ status: 'ready', text: loaded.text, version: loaded.version ?? null, error: '' })
      }, [])

      const loadDocument = useCallback(async (signal) => {
        try {
          const loaded = await io.current.readDoc(docPath, signal)
          if (signal !== undefined && signal.aborted) return null
          applyLoadedDoc(loaded)
          return loaded
        } catch (error) {
          if (signal !== undefined && signal.aborted) return null
          setDoc((prev) => (prev.status === 'ready' ? prev : { status: 'error', text: '', version: null, error: messageOf(error) }))
          return null
        }
      }, [applyLoadedDoc, docPath])

      const fetchIndex = useCallback(async (signal) => {
        try {
          const result = await io.current.readSidecar(sidecarRelPath(docPath, 'index.json'), signal)
          if (signal !== undefined && signal.aborted) return null
          const parsed = JSON.parse(result.text)
          return parsed !== null && typeof parsed === 'object' && Array.isArray(parsed.revisions) ? parsed : null
        } catch {
          return null
        }
      }, [docPath])

      const loadIndex = useCallback(async (signal) => {
        const fetched = await fetchIndex(signal)
        if (fetched !== null) setIndex({ status: 'ready', data: fetched, error: '' })
        return fetched
      }, [fetchIndex])

      // Mount: read the document, load the version index, and let the host open
      // (which creates v1 on first use and starts its file watcher).
      useEffect(() => {
        const controller = new AbortController()
        void loadDocument(controller.signal).then((loaded) => {
          if (loaded !== null && !controller.signal.aborted) {
            setBaseVersion((prev) => (prev === null ? (loaded.version ?? null) : prev))
          }
        })
        void loadIndex(controller.signal)
        void io.current.runCommand(`/screenplay open ${b64urlEncode(JSON.stringify({ doc: docPath }))}`)
          .then((result) => {
            const parsed = parseExecution(result)
            if (parsed.ok && !controller.signal.aborted) void loadIndex(controller.signal)
          })
          .catch(() => {})
        return () => controller.abort()
      }, [docPath, loadDocument, loadIndex])

      // Restore an unsent draft once the first read settles.
      useEffect(() => {
        if (doc.status !== 'ready' || hydratedFor === docPath) return
        setHydratedFor(docPath)
        const saved = loadDraft(sessionId, docPath)
        if (saved !== null && Array.isArray(saved.annotations) && saved.annotations.length > 0) {
          setAnnotations(saved.annotations)
          if (typeof saved.baseVersion === 'string') setBaseVersion(saved.baseVersion)
        }
      }, [doc.status, docPath, hydratedFor, sessionId])

      // Persist the draft as the user annotates.
      useEffect(() => {
        if (hydratedFor !== docPath) return
        const handle = setTimeout(() => {
          saveDraft(sessionId, docPath, { baseVersion: baseVersion ?? doc.version, annotations })
        }, 220)
        return () => clearTimeout(handle)
      }, [annotations, baseVersion, doc.version, docPath, hydratedFor, sessionId])

      // With nothing to send, the draft's base is simply the current draft.
      useEffect(() => {
        if (annotations.length === 0 && doc.status === 'ready') setBaseVersion(doc.version)
      }, [annotations.length, doc.status, doc.version])

      // Poll while visible: refresh content when the file version changes and
      // pick up host-written index updates (revision applied / external edits).
      useEffect(() => {
        if (tab.visible !== true) return undefined
        let cancelled = false
        let timer
        const controller = new AbortController()
        const tick = async () => {
          if (cancelled) return
          try {
            const stat = await io.current.statDoc(docPath, controller.signal)
            if (!cancelled && stat !== null && typeof stat === 'object' && stat.ok === true && stat.value !== undefined && stat.value !== null) {
              if (live.current.doc.status === 'ready' && live.current.doc.version !== stat.value.version) {
                await loadDocument(controller.signal)
              }
            }
            const fetched = await fetchIndex(controller.signal)
            if (!cancelled && fetched !== null) {
              setIndex((prev) => {
                if (prev.status === 'ready' && prev.data !== null && JSON.stringify(prev.data) === JSON.stringify(fetched)) return prev
                return { status: 'ready', data: fetched, error: '' }
              })
            }
          } catch {
            /* transient remote failures are retried on the next tick */
          }
          if (!cancelled) timer = setTimeout(tick, live.current.pending === null ? 4000 : 1800)
        }
        timer = setTimeout(tick, live.current.pending === null ? 2500 : 1200)
        return () => {
          cancelled = true
          clearTimeout(timer)
          controller.abort()
        }
      }, [tab.visible, docPath, fetchIndex, loadDocument])

      // Finish (or release) a pending revision once the host settles it.
      useEffect(() => {
        const current = live.current.pending
        if (current === null || index.status !== 'ready' || index.data === null) return
        const revision = index.data.revisions.find((entry) => entry !== null && typeof entry === 'object' && entry.id === current.revision)
        if (revision === undefined) return
        if (revision.state === 'applied') {
          setPending(null)
          void finishRevision(current, revision)
        } else if (revision.state === 'abandoned') {
          setPending(null)
          showToast(tr('toast.cancelled'))
        }
      }, [index, sessionId, docPath, showToast, tr])

      // Bound the wait: on a very slow or failed turn the send button must not
      // stay locked forever. Revisions still land on disk; the user can refresh.
      useEffect(() => {
        if (pending === null) return undefined
        const handle = setTimeout(() => {
          setPending(null)
          showToast(tr('toast.timeout'))
        }, 180000)
        return () => clearTimeout(handle)
      }, [pending, showToast, tr])

      const blocks = useMemo(() => splitBlocks(doc.text), [doc.text])
      const highlightPlans = useMemo(() => buildHighlightPlans(blocks, annotations, editing), [blocks, annotations, editing])
      // Re-anchor annotations automatically when a new draft version arrives.
      // One attempt per version; stale notes keep the stale banner up.
      useEffect(() => {
        if (doc.status !== 'ready' || doc.version === null) return
        if (annotations.length === 0) return
        if (baseVersion === null || baseVersion === doc.version) return
        const key = `${docPath}\u0000${doc.version}`
        if (reanchoredForRef.current === key) return
        reanchoredForRef.current = key
        const resolved = reanchorAnnotations(blocks, annotations)
        setAnnotations(resolved.annotations)
        if (resolved.stale === 0) {
          setBaseVersion(doc.version)
          if (resolved.changed > 0) showToast(tr('toast.reanchored'))
        } else {
          showToast(tr('toast.reanchoredPartial', { n: resolved.stale }))
        }
      }, [doc.status, doc.version, docPath, baseVersion, annotations, blocks, showToast, tr])
      const toc = useMemo(() => {
        const entries = []
        for (const block of blocks) {
          if (block.type === 'scene_heading') {
            entries.push({ index: block.index, level: 2, text: block.text.split('\n')[0] })
          } else if (block.type === 'heading') {
            entries.push({ index: block.index, level: 1, text: block.text })
          }
        }
        return entries
      }, [blocks])
      const headRevision = useMemo(() => {
        if (index.status !== 'ready' || index.data === null) return null
        const revisions = index.data.revisions
        return revisions.length === 0 ? null : revisions[revisions.length - 1]
      }, [index])
      const currentSeq = headRevision === null ? null : headRevision.seq
      const headPending = headRevision !== null && headRevision.kind === 'send' && headRevision.state === 'pending'
      const isStale = annotations.length > 0 && baseVersion !== null && doc.version !== null && baseVersion !== doc.version
      const pendingActive = pending !== null || headPending

      const refreshAll = async () => {
        const controller = new AbortController()
        await loadDocument(controller.signal)
        await loadIndex(controller.signal)
      }

      const triggerFlash = (blockIndex) => {
        if (flashTimer.current !== undefined) clearTimeout(flashTimer.current)
        setFlash(null)
        const run = () => {
          setFlash(blockIndex)
          flashTimer.current = setTimeout(() => setFlash(null), 1800)
        }
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(() => window.requestAnimationFrame(run))
        } else {
          run()
        }
      }

      const jumpTo = (blockIndex) => {
        setTocOpen(false)
        const root = rootRef.current
        if (root === null) return
        const node = root.querySelector(`[data-spm-block="${blockIndex}"]`)
        if (node !== null && typeof node.scrollIntoView === 'function') node.scrollIntoView({ behavior: 'smooth', block: 'start' })
        triggerFlash(blockIndex)
      }

      const startEdit = (block, existing, selectedQuote, selectedSegments, selectedEndBlockIndex) => {
        savedSelectionRef.current = existing !== undefined || typeof selectedQuote !== 'string' ? null : savedSelectionRef.current
        const segmentBlocks = existing !== undefined && Array.isArray(existing.segments)
          ? existing.segments
              .map((segment) => segment !== null && typeof segment === 'object' && Number.isInteger(segment.blockIndex) ? segment.blockIndex : -1)
              .filter((value) => value >= 0)
          : []
        const startBlockIndex = block.index
        let endBlockIndex = startBlockIndex
        if (segmentBlocks.length > 0) endBlockIndex = Math.max(startBlockIndex, ...segmentBlocks)
        else if (Number.isInteger(selectedEndBlockIndex) && selectedEndBlockIndex > startBlockIndex) endBlockIndex = selectedEndBlockIndex
        else if (Number.isInteger(existing?.endBlockIndex) && existing.endBlockIndex > startBlockIndex) endBlockIndex = existing.endBlockIndex
        const editingLevel = existing !== undefined && existing.level === 'sentence'
          ? 'sentence'
          : (typeof selectedQuote === 'string' ? 'sentence' : 'block')
        const editingSegments = existing !== undefined && Array.isArray(existing.segments)
          ? existing.segments
          : (Array.isArray(selectedSegments) && selectedSegments.length > 0 ? selectedSegments : undefined)
        const editingAnchor = existing !== undefined && existing.anchor !== null && typeof existing.anchor === 'object'
          ? existing.anchor
          : buildAnchor(blocks, block.index, editingLevel, editingSegments)
        setBubble(null)
        setEditing({
          blockIndex: block.index,
          blockHash: block.hash,
          startBlockIndex,
          endBlockIndex,
          anchor: editingAnchor === null ? undefined : editingAnchor,
          quote: existing !== undefined && typeof existing.quote === 'string'
            ? existing.quote
            : (typeof selectedQuote === 'string' ? selectedQuote : block.text.slice(0, 120)),
          note: existing !== undefined && typeof existing.note === 'string' ? existing.note : '',
          tag: existing !== undefined && typeof existing.tag === 'string' ? existing.tag : TAGS[0],
          id: existing !== undefined ? existing.id : undefined,
          level: editingLevel,
          segments: editingSegments,
        })
      }

      const closeEditor = () => {
        savedSelectionRef.current = null
        try {
          const selection = window.getSelection()
          if (selection !== null && selection.rangeCount > 0) selection.removeAllRanges()
        } catch {
          /* selection may already be gone */
        }
        setEditing(null)
      }

      const saveEdit = () => {
        if (editing === null) return
        const note = String(editing.note).trim()
        if (note === '') {
          closeEditor()
          return
        }
        const next = {
          id: editing.id !== undefined ? editing.id : `a${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          blockIndex: editing.blockIndex,
          blockHash: editing.blockHash,
          quote: editing.quote,
          note,
          tag: editing.tag,
          level: editing.level === 'sentence' ? 'sentence' : 'block',
          segments: Array.isArray(editing.segments) && editing.segments.length > 0 ? editing.segments : undefined,
          anchor: editing.anchor === undefined || editing.anchor === null ? undefined : editing.anchor,
        }
        setAnnotations((prev) => [...prev.filter((annotation) => annotation.id !== next.id), next])
        closeEditor()
      }

      const removeAnnotation = (id) => {
        setAnnotations((prev) => prev.filter((annotation) => annotation.id !== id))
      }

      const collectSelectionSegments = (range) => {
        const root = rootRef.current
        if (root === null) return []
        const rangeClass = typeof window !== 'undefined' && window.Range !== undefined ? window.Range : undefined
        const startToStart = rangeClass !== undefined ? rangeClass.START_TO_START : 0
        const endToEnd = rangeClass !== undefined ? rangeClass.END_TO_END : 2
        const elements = Array.from(root.querySelectorAll('[data-spm-block]'))
        const segments = []
        for (const element of elements) {
          let intersects = false
          try {
            intersects = range.intersectsNode(element)
          } catch {
            intersects = false
          }
          if (!intersects) continue
          const pieceRange = document.createRange()
          pieceRange.selectNodeContents(element)
          try {
            if (range.compareBoundaryPoints(startToStart, pieceRange) > 0) pieceRange.setStart(range.startContainer, range.startOffset)
            if (range.compareBoundaryPoints(endToEnd, pieceRange) < 0) pieceRange.setEnd(range.endContainer, range.endOffset)
          } catch {
            continue
          }
          let piece = ''
          try {
            piece = pieceRange.toString()
          } catch {
            piece = ''
          }
          piece = piece.replace(/\s+/g, ' ').trim()
          if (piece === '') continue
          const index = Number(element.getAttribute('data-spm-block'))
          const block = blocks[index]
          if (block === undefined) continue
          segments.push({ blockIndex: index, blockHash: block.hash, text: piece.slice(0, 500) })
        }
        return segments
      }

      const handleSelectionMouseUp = (event) => {
        const target = event.target
        if (target !== null && typeof target.closest === 'function' && target.closest('.spm-note,.spm-editor,.spm-dialog,.spm-sel-bubble') !== null) return
        const selection = window.getSelection()
        if (selection === null || selection.isCollapsed === true) return
        const text = String(selection.toString()).trim()
        if (text === '') return
        const anchorNode = selection.anchorNode
        if (anchorNode === null || anchorNode === undefined) return
        const anchorElement = anchorNode.nodeType === 1 ? anchorNode : anchorNode.parentElement
        if (anchorElement === null || anchorElement === undefined || typeof anchorElement.closest !== 'function') return
        const blockElement = anchorElement.closest('[data-spm-block]')
        if (blockElement === null) return
        const anchorIndex = Number(blockElement.getAttribute('data-spm-block'))
        const anchorBlock = blocks[anchorIndex]
        if (anchorBlock === undefined) return
        let quote = text.replace(/\s+/g, ' ').trim()
        if (quote.length > 2000) quote = `${quote.slice(0, 2000)}…`
        const range = selection.getRangeAt(0)
        const startBlockElement = blockElementFor(range.startContainer)
        const endBlockElement = blockElementFor(range.endContainer)
        if (startBlockElement !== null && endBlockElement !== null) {
          const startOffset = offsetWithinBlock(startBlockElement, range.startContainer, range.startOffset)
          const endOffset = offsetWithinBlock(endBlockElement, range.endContainer, range.endOffset)
          if (startOffset !== null && endOffset !== null) {
            savedSelectionRef.current = {
              startBlockIndex: Number(startBlockElement.getAttribute('data-spm-block')),
              startOffset,
              endBlockIndex: Number(endBlockElement.getAttribute('data-spm-block')),
              endOffset,
            }
          }
        }
        const segments = collectSelectionSegments(range)
        const rects = typeof range.getClientRects === 'function' ? range.getClientRects() : null
        const lastRect = rects !== null && rects !== undefined && rects.length > 0
          ? rects[rects.length - 1]
          : range.getBoundingClientRect()
        const rootRect = rootRef.current === null ? null : rootRef.current.getBoundingClientRect()
        if (rootRect === null) return
        // Anchor the bubble to the END of the selection: just past the last
        // character on the final selected line. If that would overflow the
        // panel, right-align it to the selection end instead.
        const bubbleLabel = `＋ ${tr('btn.annotateSelection')}`
        const bubbleWidth = Math.min(240, 32 + Array.from(bubbleLabel).reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 11 : 6), 0))
        const bubbleHeight = 26
        const relativeRight = lastRect.right - rootRect.left
        const relativeTop = lastRect.top - rootRect.top
        const left = relativeRight + bubbleWidth + 10 <= rootRect.width - 4
          ? relativeRight + 6
          : Math.max(4, relativeRight - bubbleWidth - 6)
        const top = Math.min(Math.max(4, relativeTop - bubbleHeight - 6), Math.max(4, rootRect.height - 72))
        setBubble({ blockIndex: anchorIndex, blockHash: anchorBlock.hash, quote, segments, top, left })
      }

      const annotateSelection = () => {
        if (bubble === null) return
        const block = blocks[bubble.blockIndex]
        const quote = bubble.quote
        const segments = bubble.segments
        const saved = savedSelectionRef.current
        const endBlockIndex = saved !== null && Number.isInteger(saved.endBlockIndex) ? saved.endBlockIndex : bubble.blockIndex
        setBubble(null)
        if (block === undefined) return
        startEdit(block, undefined, quote, segments, endBlockIndex)
      }

      const relocate = async () => {
        setStaleOpen(false)
        const controller = new AbortController()
        try {
          const loaded = await io.current.readDoc(docPath, controller.signal)
          const nextBlocks = splitBlocks(loaded.text)
          const resolved = reanchorAnnotations(nextBlocks, live.current.annotations)
          applyLoadedDoc(loaded)
          setAnnotations(resolved.annotations)
          if (resolved.stale === 0) setBaseVersion(loaded.version ?? null)
          showToast(resolved.stale > 0 ? tr('toast.relocatedPartial', { n: resolved.stale }) : tr('toast.relocated'))
        } catch (error) {
          showToast(tr('toast.failed', { msg: messageOf(error) }))
        }
      }

      // After an applied revision: reload the draft, diff it against the text the
      // annotations were written on, and report edits outside the annotated range.
      const finishRevision = async (current, revision) => {
        try {
          const loaded = await io.current.readDoc(docPath)
          const baseBlocks = splitBlocks(typeof current.baseText === 'string' ? current.baseText : '')
          const nextBlocks = splitBlocks(loaded.text)
          const scope = evaluateRevisionScope(baseBlocks, nextBlocks, Array.isArray(current.annotations) ? current.annotations : [])
          applyLoadedDoc(loaded)
          setBaseVersion(loaded.version ?? null)
          setAnnotations([])
          clearDraft(sessionId, docPath)
          setRevisionReport(Object.assign({
            seq: revision.seq,
            baseRevision: typeof current.baseRevision === 'string' ? current.baseRevision : null,
            baseSeq: Number.isInteger(current.baseSeq) ? current.baseSeq : null,
            at: Date.now(),
          }, scope))
          setReportOpen(scope.outOfScope.length > 0)
          if (scope.outOfScope.length > 0) {
            showToast(tr('toast.revisionOutOfScope', { n: scope.outOfScope.length }))
          } else {
            showToast(tr('toast.appliedScoped', { seq: revision.seq }))
          }
        } catch (error) {
          showToast(tr('toast.failed', { msg: messageOf(error) }))
        }
      }

      const rollbackRevision = async () => {
        const report = revisionReport
        if (report === null || typeof report.baseRevision !== 'string' || report.baseRevision === '') {
          showToast(tr('toast.noRollbackBase'))
          return
        }
        try {
          const result = await io.current.runCommand(`/screenplay restore ${b64urlEncode(JSON.stringify({ doc: docPath, revision: report.baseRevision }))}`)
          const parsed = parseExecution(result)
          if (!parsed.ok) {
            showToast(tr('toast.failed', { msg: parsed.text }))
            return
          }
          setRevisionReport(null)
          setReportOpen(false)
          await refreshAll()
          showToast(tr('toast.rolledBack'))
        } catch (error) {
          showToast(tr('toast.failed', { msg: messageOf(error) }))
        }
      }

      const send = async () => {
        if (sending || pendingActive || annotations.length === 0) return
        if (isStale) {
          setStaleOpen(true)
          return
        }
        setSending(true)
        setRevisionReport(null)
        setReportOpen(false)
        try {
          const payload = {
            doc: docPath,
            baseVersion: baseVersion ?? doc.version,
            annotations: annotations.map((annotation) => ({
              id: annotation.id,
              blockIndex: annotation.blockIndex,
              blockHash: annotation.blockHash,
              quote: annotation.quote,
              note: annotation.note,
              tag: annotation.tag,
              level: annotation.level === 'sentence' ? 'sentence' : 'block',
            })),
          }
          const result = await io.current.runCommand(`/screenplay send ${b64urlEncode(JSON.stringify(payload))}`)
          const parsed = parseExecution(result)
          if (!parsed.ok) {
            if (parsed.code === 'E_STALE') {
              setStaleOpen(true)
              await refreshAll()
            } else {
              showToast(tr('toast.failed', { msg: parsed.text }))
            }
            return
          }
          const value = parsed.value !== null && typeof parsed.value === 'object' ? parsed.value : {}
          setPending({
            revision: value.revision,
            seq: value.seq,
            at: Date.now(),
            baseText: doc.text,
            baseRevision: headRevision !== null ? headRevision.id : null,
            baseSeq: headRevision !== null ? headRevision.seq : null,
            annotations: annotations.map((annotation) => Object.assign({}, annotation, {
              segments: Array.isArray(annotation.segments) ? annotation.segments.map((segment) => Object.assign({}, segment)) : undefined,
            })),
          })
          showToast(tr('toast.sent', { n: annotations.length }))
        } catch (error) {
          showToast(tr('toast.failed', { msg: messageOf(error) }))
        } finally {
          setSending(false)
        }
      }

      const cancelPending = async () => {
        if (!pendingActive) return
        try {
          const result = await io.current.runCommand(`/screenplay cancel ${b64urlEncode(JSON.stringify({ doc: docPath }))}`)
          const parsed = parseExecution(result)
          if (!parsed.ok) showToast(tr('toast.failed', { msg: parsed.text }))
          else showToast(tr('toast.cancelled'))
        } catch (error) {
          showToast(tr('toast.failed', { msg: messageOf(error) }))
        }
        setPending(null)
        await refreshAll()
      }

      const openVersions = () => {
        setVersionsOpen(true)
        void loadIndex(new AbortController().signal)
      }

      const openPreview = async (revision) => {
        setPreview({ revision, text: '', prevText: null, loading: true, error: '', showDiff: false })
        const controller = new AbortController()
        try {
          const hash = typeof revision.resultHash === 'string' ? revision.resultHash : revision.baseHash
          const result = await io.current.readSidecar(sidecarRelPath(docPath, 'snapshots', `${hash}.md`), controller.signal)
          const revisions = index.status === 'ready' && index.data !== null && Array.isArray(index.data.revisions) ? index.data.revisions : []
          const position = revisions.findIndex((entry) => entry !== null && typeof entry === 'object' && entry.id === revision.id)
          let prevText = null
          if (position > 0) {
            const previous = revisions[position - 1]
            const prevHash = typeof previous.resultHash === 'string' ? previous.resultHash : previous.baseHash
            if (typeof prevHash === 'string') {
              try {
                const previousResult = await io.current.readSidecar(sidecarRelPath(docPath, 'snapshots', `${prevHash}.md`), controller.signal)
                prevText = previousResult.text
              } catch {
                prevText = null
              }
            }
          }
          setPreview({ revision, text: result.text, prevText, loading: false, error: '', showDiff: false })
        } catch (error) {
          setPreview({ revision, text: '', prevText: null, loading: false, error: messageOf(error), showDiff: false })
        }
      }

      const restore = async (revision) => {
        try {
          const result = await io.current.runCommand(`/screenplay restore ${b64urlEncode(JSON.stringify({ doc: docPath, revision: revision.id }))}`)
          const parsed = parseExecution(result)
          if (!parsed.ok) {
            showToast(tr('toast.failed', { msg: parsed.text }))
            return
          }
          const value = parsed.value !== null && typeof parsed.value === 'object' ? parsed.value : {}
          await refreshAll()
          setPreview(null)
          setVersionsOpen(false)
          showToast(tr('toast.restored', { from: value.restoredFrom, current: value.seq }))
        } catch (error) {
          showToast(tr('toast.failed', { msg: messageOf(error) }))
        }
      }

      const renderEditor = () => {
        if (editing === null) return null
        return h('div', { className: 'spm-editor' },
          editing.level === 'sentence' && typeof editing.quote === 'string' && editing.quote !== ''
            ? h('div', { className: 'spm-editor-quote', title: editing.quote }, `「${truncateText(editing.quote, 160)}」`)
            : null,
          h('textarea', {
            className: 'spm-textarea',
            value: editing.note,
            placeholder: tr('editor.placeholder'),
            autoFocus: true,
            onChange: (event) => setEditing(Object.assign({}, editing, { note: event.target.value })),
            onKeyDown: (event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                saveEdit()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                closeEditor()
              }
            },
          }),
          h('div', { className: 'spm-editor-row' },
            h('span', { className: 'spm-hint' }, tr('editor.tag')),
            h('select', {
              className: 'spm-select',
              value: editing.tag,
              onChange: (event) => setEditing(Object.assign({}, editing, { tag: event.target.value })),
            }, TAGS.map((tag) => h('option', { key: tag, value: tag }, tag))),
            h('div', { style: { flex: '1 1 auto' } }),
            h('button', { type: 'button', className: 'spm-btn', onClick: closeEditor }, tr('btn.cancel')),
            h('button', { type: 'button', className: 'spm-btn spm-btn-primary', onClick: saveEdit }, tr('btn.save')),
          ),
        )
      }

      const renderBlock = (block, inGroup) => {
        const lineInfos = Array.isArray(block.lines) && block.lines.length > 0 ? block.lines : [{ type: 'action', text: block.text }]
        const isScene = block.type === 'scene_heading'
        const isAct = block.type === 'heading'
        const blockAnnotations = annotations.filter((annotation) =>
          annotation.blockIndex === block.index
          || (annotation.blockHash !== undefined && annotation.blockHash !== '' && annotation.blockHash === block.hash),
        )
        const editingStart = editing === null ? -1 : (Number.isInteger(editing.startBlockIndex) ? editing.startBlockIndex : editing.blockIndex)
        const editingEnd = editing === null ? -1 : (Number.isInteger(editing.endBlockIndex) ? editing.endBlockIndex : editing.blockIndex)
        const inEditRange = editing !== null && block.index >= editingStart && block.index <= editingEnd
        const editorAtEnd = inEditRange && block.index === editingEnd
        const sentenceRange = inEditRange && editing !== null && editing.level === 'sentence' && editingEnd > editingStart && inGroup !== true
        const plannedRanges = highlightPlans.get(block.index)
        const highlightRanges = mergeHighlightRanges(plannedRanges === undefined ? [] : plannedRanges)
        let lineOffset = 0
        return h('div', {
          key: `${block.index}:${block.hash}`,
          className: `spm-block${isScene ? ' spm-block-scene' : ''}${isAct ? ' spm-block-act' : ''}${blockAnnotations.length > 0 ? ' spm-block-annotated' : ''}${flash === block.index ? ' spm-block-flash' : ''}${sentenceRange ? ' spm-block-edit-range' : ''}${sentenceRange && block.index === editingStart ? ' spm-block-edit-range-first' : ''}${sentenceRange && block.index === editingEnd ? ' spm-block-edit-range-last' : ''}`,
          'data-spm-block': block.index,
        },
          !inEditRange ? h('button', { type: 'button', className: 'spm-gutter', title: tr('btn.annotate'), onClick: () => startEdit(block) }, '＋') : null,
          h('div', null, lineInfos.map((lineInfo, lineIndex) => {
            const line = lineInfo.text
            const lineStart = lineOffset
            lineOffset += line.length + 1
            const pieces = lineSegments(line, lineStart, highlightRanges)
            const children = pieces.map((piece, position) => piece.highlight
              ? h('mark', { key: `m${position}`, className: `spm-hl${piece.active ? ' spm-hl-active' : ''}` }, piece.text)
              : piece.text)
            if (block.inline === true && lineIndex === 0 && typeof block.inlineSpeaker === 'string') {
              const speakerEnd = lineStart + block.inlineSpeaker.length
              const inlineChildren = pieces.map((piece, position) => {
                const content = piece.highlight
                  ? h('mark', { key: `m${position}`, className: `spm-hl${piece.active ? ' spm-hl-active' : ''}` }, piece.text)
                  : piece.text
                if (piece.start < speakerEnd) return h('span', { key: `s${position}`, className: 'spm-speaker' }, content)
                return content
              })
              return h('div', { key: lineIndex, className: 'spm-line spm-line-dialogue' }, inlineChildren)
            }
            return h('div', { key: lineIndex, className: screenplayLineClass(lineInfo.type) }, children)
          })),
          blockAnnotations.length > 0 ? h('div', { className: 'spm-notes' }, blockAnnotations.map((annotation) => (
            editing !== null && editing.id === annotation.id
              ? null
              : h('div', {
                  key: annotation.id !== undefined ? annotation.id : `${annotation.blockIndex}-${annotation.note.length}`,
                  className: 'spm-note',
                },
                  h('div', { className: 'spm-note-head' },
                    h('span', { className: 'spm-note-tag' }, annotation.tag !== undefined ? annotation.tag : '改稿'),
                    annotation.level === 'sentence' ? h('span', { className: 'spm-note-quote' }, `「${truncateText(annotation.quote, 42)}」`) : null,
                    h('span', { className: 'spm-note-actions' },
                      h('button', { type: 'button', className: 'spm-icon-btn', title: tr('btn.annotate'), onClick: () => startEdit(block, annotation) }, '✎'),
                      h('button', { type: 'button', className: 'spm-icon-btn', title: tr('btn.delete'), onClick: () => removeAnnotation(annotation.id) }, '✕'),
                    ),
                  ),
                  h('div', null, annotation.note),
                  annotation.unmatched === true || annotation.stale === true ? h('div', { className: 'spm-hint' }, tr('note.unmatched')) : null,
                )
          ))) : null,
          editorAtEnd && inGroup !== true ? renderEditor() : null,
        )
      }

      const renderHeader = () => h('div', { className: 'spm-head' },
        h('div', { className: 'spm-title', title: docPath }, baseName(docPath)),
        currentSeq !== null ? h('span', { className: 'spm-badge' }, tr('badge.version', { seq: currentSeq })) : null,
        pendingActive ? h('span', { className: 'spm-badge spm-badge-warn' }, tr('badge.pending')) : null,
        h('button', { type: 'button', className: 'spm-tool', title: tr('btn.typography'), onClick: () => setTypographyOpen(true) }, 'Aa'),
        h('button', { type: 'button', className: 'spm-tool', title: tr('btn.toc'), onClick: () => setTocOpen(true) }, '☰'),
        h('button', { type: 'button', className: 'spm-tool', title: tr('btn.refresh'), onClick: () => void refreshAll() }, '⟳'),
        h('button', { type: 'button', className: 'spm-btn', onClick: openVersions }, tr('btn.versions')),
      )

      const renderBody = () => {
        if (doc.status === 'loading') return h('div', { className: 'spm-empty' }, tr('doc.loading'))
        if (doc.status === 'error') {
          return h('div', { className: 'spm-empty' },
            h('div', null, tr('doc.error', { msg: doc.error })),
            h('div', { className: 'spm-empty-actions' },
              h('button', { type: 'button', className: 'spm-btn', onClick: () => void refreshAll() }, tr('doc.retry')),
            ),
          )
        }
        if (blocks.length === 0) return h('div', { className: 'spm-empty' }, tr('doc.empty'))
        const segmentRange = (segments) => {
          if (!Array.isArray(segments)) return null
          const indices = []
          for (const segment of segments) {
            if (segment !== null && typeof segment === 'object' && Number.isInteger(segment.blockIndex)) indices.push(segment.blockIndex)
          }
          if (indices.length < 2) return null
          return { start: Math.min(...indices), end: Math.max(...indices) }
        }
        const ranges = []
        if (editing !== null && editing.level === 'sentence') {
          const indices = []
          if (Number.isInteger(editing.startBlockIndex)) indices.push(editing.startBlockIndex)
          if (Number.isInteger(editing.endBlockIndex)) indices.push(editing.endBlockIndex)
          if (Number.isInteger(editing.blockIndex)) indices.push(editing.blockIndex)
          const fromSegments = segmentRange(editing.segments)
          if (fromSegments !== null) indices.push(fromSegments.start, fromSegments.end)
          const plan = planQuoteHighlights(blocks, editing.quote)
          if (plan.size > 1) {
            const keys = Array.from(plan.keys())
            indices.push(Math.min(...keys), Math.max(...keys))
          }
          if (indices.length > 0) {
            const start = Math.min(...indices)
            const end = Math.max(...indices)
            if (end > start) ranges.push({ start, end, editing: true, key: 'edit' })
          }
        }
        for (const annotation of annotations) {
          if (annotation === null || typeof annotation !== 'object' || annotation.level !== 'sentence') continue
          let range = segmentRange(annotation.segments)
          if (range === null) {
            const plan = planQuoteHighlights(blocks, annotation.quote)
            if (plan.size > 1) {
              const indices = Array.from(plan.keys())
              range = { start: Math.min(...indices), end: Math.max(...indices) }
            }
          }
          if (range !== null && range.end > range.start) {
            ranges.push({ start: range.start, end: range.end, editing: false, key: `ann:${annotation.id}` })
          }
        }
        ranges.sort((left, right) => left.start - right.start)
        const groups = []
        for (const range of ranges) {
          const last = groups[groups.length - 1]
          if (last !== undefined && range.start <= last.end + 1) {
            last.end = Math.max(last.end, range.end)
            last.editing = last.editing === true || range.editing === true
            last.key = `${last.key}+${range.key}`
          } else {
            groups.push({ start: range.start, end: range.end, editing: range.editing === true, key: range.key })
          }
        }
        if (groups.length === 0) return blocks.map((block) => renderBlock(block))
        const nodes = []
        let position = 0
        while (position < blocks.length) {
          const block = blocks[position]
          const group = groups.find((candidate) => block.index >= candidate.start && block.index <= candidate.end)
          if (group === undefined) {
            nodes.push(renderBlock(block))
            position += 1
            continue
          }
          if (block.index !== group.start) {
            position += 1
            continue
          }
          const endPosition = blocks.findIndex((candidate) => candidate.index === group.end)
          if (endPosition === -1) {
            nodes.push(renderBlock(block))
            position += 1
            continue
          }
          const groupBlocks = blocks.slice(position, endPosition + 1)
          nodes.push(h('div', {
            key: `spm-group:${group.key}`,
            className: `spm-edit-group${group.editing === true ? '' : ' spm-annotation-group'}`,
            'data-spm-group': `${group.start}-${group.end}`,
          },
            group.editing === true ? null : h('span', { className: 'spm-group-label' }, tr('group.annotationCount', { n: groupBlocks.length })),
            groupBlocks.map((inner) => renderBlock(inner, true)),
            group.editing === true ? renderEditor() : null,
          ))
          position = endPosition + 1
        }
        return nodes
      }

      const renderFooter = () => h('div', { className: 'spm-foot' },
        h('div', { className: 'spm-foot-count' },
          pendingActive
            ? tr('footer.pending')
            : annotations.length > 0 ? tr('footer.count', { n: annotations.length }) : tr('footer.none'),
        ),
        pendingActive ? h('button', {
          type: 'button',
          className: 'spm-btn',
          onClick: () => void cancelPending(),
        }, tr('btn.cancelPending')) : null,
        h('button', {
          type: 'button',
          className: 'spm-btn spm-btn-primary',
          disabled: sending || pendingActive || annotations.length === 0,
          onClick: () => void send(),
        }, sending ? tr('btn.sending') : tr('btn.send', { n: annotations.length })),
      )

      const renderVersions = () => {
        if (!versionsOpen) return null
        const revisions = index.status === 'ready' && index.data !== null && Array.isArray(index.data.revisions)
          ? index.data.revisions.slice().sort((left, right) => right.seq - left.seq)
          : []
        const kindLabel = (kind) => {
          const key = `versions.kind.${kind}`
          const label = tRef.current(key)
          return label === key ? kind : label
        }
        const body = preview !== null
          ? h('div', { className: 'spm-dialog-body' },
              h('div', { className: 'spm-preview-head' },
                h('span', { className: 'spm-dialog-title' }, tr('versions.preview', { seq: preview.revision.seq })),
                preview.loading ? h('span', { className: 'spm-badge' }, tr('versions.loading')) : null,
                preview.error !== '' ? h('span', { className: 'spm-badge spm-badge-warn' }, tr('versions.error', { msg: preview.error })) : null,
                h('div', { style: { flex: '1 1 auto' } }),
                h('button', { type: 'button', className: 'spm-btn', onClick: () => setPreview(null) }, tr('btn.back')),
                preview.text !== '' ? h('button', {
                  type: 'button',
                  className: 'spm-btn',
                  onClick: () => setPreview(Object.assign({}, preview, { showDiff: !preview.showDiff })),
                }, preview.showDiff ? tr('btn.hideDiff') : tr('btn.diff')) : null,
                h('button', {
                  type: 'button',
                  className: 'spm-btn spm-btn-danger',
                  onClick: () => void restore(preview.revision),
                }, tr('btn.restore')),
              ),
              preview.loading
                ? h('div', { className: 'spm-empty' }, tr('versions.loading'))
                : preview.error !== ''
                  ? h('div', { className: 'spm-empty' }, tr('versions.error', { msg: preview.error }))
                  : preview.showDiff && preview.prevText !== null
                    ? h('div', { className: 'spm-pre' }, diffLines(preview.prevText, preview.text).map((line, position) => h('div', {
                        key: position,
                        className: `spm-diff-line spm-diff-${line.type === 'same' ? 'same' : line.type}`,
                      }, `${line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '} ${line.text}`)))
                    : h('pre', { className: 'spm-pre' }, preview.text),
            )
          : h('div', { className: 'spm-dialog-body' },
              revisions.length === 0
                ? h('div', { className: 'spm-empty' }, tr('versions.empty'))
                : revisions.map((revision) => h('div', {
                    key: revision.id,
                    className: 'spm-version-row',
                    role: 'button',
                    tabIndex: 0,
                    onClick: () => void openPreview(revision),
                  },
                    h('span', { className: 'spm-version-seq' }, `v${revision.seq}`),
                    h('span', { className: 'spm-version-meta' },
                      `${kindLabel(revision.kind)} · ${formatTime(revision.time)}`,
                      revision.annotationCount > 0 ? ` · ${tr('versions.annotations', { n: revision.annotationCount })}` : '',
                      revision.kind === 'send' && revision.state === 'pending' ? ` · ${tr('badge.pending')}` : '',
                      revision.state === 'abandoned' ? ` · ${tr('versions.abandoned')}` : '',
                    ),
                    index.data != null && index.data.head === revision.id ? h('span', { className: 'spm-badge' }, tr('versions.current')) : null,
                  )),
            )
        return h('div', { className: 'spm-overlay', onClick: () => { setVersionsOpen(false); setPreview(null) } },
          h('div', { className: 'spm-dialog', onClick: (event) => event.stopPropagation() },
            h('div', { className: 'spm-dialog-head' },
              h('span', { className: 'spm-dialog-title' }, tr('versions.title')),
              h('div', { style: { flex: '1 1 auto' } }),
              h('button', { type: 'button', className: 'spm-btn', onClick: () => { setVersionsOpen(false); setPreview(null) } }, tr('btn.close')),
            ),
            body,
          ),
        )
      }

      const renderToc = () => {
        if (!tocOpen) return null
        return h('div', { className: 'spm-overlay', onClick: () => setTocOpen(false) },
          h('div', { className: 'spm-dialog', onClick: (event) => event.stopPropagation() },
            h('div', { className: 'spm-dialog-head' },
              h('span', { className: 'spm-dialog-title' }, tr('toc.title')),
              h('div', { style: { flex: '1 1 auto' } }),
              h('button', { type: 'button', className: 'spm-btn', onClick: () => setTocOpen(false) }, tr('btn.close')),
            ),
            h('div', { className: 'spm-dialog-body' },
              toc.length === 0
                ? h('div', { className: 'spm-empty' }, tr('toc.empty'))
                : toc.map((entry) => h('div', {
                    key: `${entry.index}:${entry.text}`,
                    className: `spm-toc-row spm-toc-level${entry.level}`,
                    role: 'button',
                    tabIndex: 0,
                    onClick: () => jumpTo(entry.index),
                  }, entry.text)),
            ),
          ),
        )
      }

      const renderRevisionReport = () => {
        if (!reportOpen || revisionReport === null) return null
        const report = revisionReport
        const changes = report.outOfScope
        const kindLabel = (kind) => {
          const key = `report.kind.${kind}`
          const label = tRef.current(key)
          return label === key ? kind : label
        }
        return h('div', { className: 'spm-overlay', onClick: () => setReportOpen(false) },
          h('div', { className: 'spm-dialog', onClick: (event) => event.stopPropagation() },
            h('div', { className: 'spm-dialog-head' },
              h('span', { className: 'spm-dialog-title' }, tr('report.title', { seq: report.seq })),
              h('div', { style: { flex: '1 1 auto' } }),
              h('button', { type: 'button', className: 'spm-btn', onClick: () => setReportOpen(false) }, tr('btn.close')),
            ),
            h('div', { className: 'spm-dialog-body' },
              h('div', { className: 'spm-hint', style: { marginBottom: '10px' } },
                changes.length > 0
                  ? tr('report.summary', { n: changes.length, m: report.inScope })
                  : tr('report.noIssues'),
              ),
              changes.length > 0 ? h('div', { className: 'spm-report-list' }, changes.map((change, index) => h('div', {
                key: `report:${index}`,
                className: 'spm-report-row',
              },
                h('div', { className: 'spm-report-kind' }, kindLabel(change.kind)),
                typeof change.before === 'string' ? h('div', { className: 'spm-report-before' }, `${tr('report.before')}${truncateText(change.before, 180)}`) : null,
                typeof change.after === 'string' ? h('div', { className: 'spm-report-after' }, `${tr('report.after')}${truncateText(change.after, 180)}`) : null,
              ))) : null,
              changes.length > 0 ? h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' } },
                h('button', { type: 'button', className: 'spm-btn', onClick: () => setReportOpen(false) }, tr('btn.close')),
                h('button', { type: 'button', className: 'spm-btn spm-btn-primary', onClick: () => void rollbackRevision() }, tr('btn.rollbackRevision')),
              ) : null,
            ),
          ),
        )
      }

      const renderTypography = () => {
        if (!typographyOpen) return null
        const update = (patch) => setTypography((prev) => normalizeTypography(Object.assign({}, prev, patch)))
        const row = (label, value, min, max, step, text, onChange) => h('div', { className: 'spm-typography-row' },
          h('span', { className: 'spm-typography-label' }, label),
          h('input', {
            className: 'spm-range',
            type: 'range',
            min: String(min),
            max: String(max),
            step: String(step),
            value: String(value),
            onChange,
          }),
          h('span', { className: 'spm-value' }, text),
        )
        return h('div', { className: 'spm-overlay', onClick: () => setTypographyOpen(false) },
          h('div', { className: 'spm-dialog', onClick: (event) => event.stopPropagation() },
            h('div', { className: 'spm-dialog-head' },
              h('span', { className: 'spm-dialog-title' }, tr('typography.title')),
              h('div', { style: { flex: '1 1 auto' } }),
              h('button', { type: 'button', className: 'spm-btn', onClick: () => setTypographyOpen(false) }, tr('btn.close')),
            ),
            h('div', { className: 'spm-dialog-body' },
              h('div', { className: 'spm-typo-hint' }, tr('typography.hint')),
              h('div', {
                className: 'spm-typo-preview',
                style: {
                  '--spm-line-height': String(typography.lineHeight),
                  '--spm-block-gap': `${typography.blockGap}px`,
                  '--spm-font-size': `${typography.fontSize}px`,
                },
              },
                h('div', { className: 'spm-block' },
                  h('div', { className: 'spm-line spm-line-scene' }, '1. 内景 出租屋 - 夜'),
                ),
                h('div', { className: 'spm-block' },
                  h('div', { className: 'spm-line spm-line-character' }, '林小满'),
                  h('div', { className: 'spm-line spm-line-paren' }, '（低声）'),
                  h('div', { className: 'spm-line spm-line-dialogue' }, '我们明天再谈。'),
                ),
                h('div', { className: 'spm-block' },
                  h('div', { className: 'spm-line' }, '她关上门，没有回头。'),
                ),
              ),
              row(tr('typography.lineHeight'), typography.lineHeight, 1.3, 2.4, 0.05, typography.lineHeight.toFixed(2), (event) => update({ lineHeight: Number(event.target.value) })),
              row(tr('typography.blockGap'), typography.blockGap, 0, 56, 2, `${typography.blockGap}px`, (event) => update({ blockGap: Number(event.target.value) })),
              row(tr('typography.fontSize'), typography.fontSize, 11, 20, 0.5, `${typography.fontSize}px`, (event) => update({ fontSize: Number(event.target.value) })),
              h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '12px' } },
                h('button', { type: 'button', className: 'spm-btn', onClick: () => setTypography(normalizeTypography({ lineHeight: 1.85, blockGap: 10, fontSize: 13.5 })) }, tr('typography.reset')),
              ),
            ),
          ),
        )
      }

      const renderStale = () => {
        if (!staleOpen) return null
        return h('div', { className: 'spm-overlay', onClick: () => setStaleOpen(false) },
          h('div', { className: 'spm-dialog', onClick: (event) => event.stopPropagation() },
            h('div', { className: 'spm-dialog-head' },
              h('span', { className: 'spm-dialog-title' }, tr('staleModal.title')),
            ),
            h('div', { className: 'spm-hint', style: { marginBottom: '12px' } },
              tr('staleModal.body', { latest: headRevision !== null ? headRevision.seq : '?' }),
            ),
            h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } },
              h('button', { type: 'button', className: 'spm-btn', onClick: () => setStaleOpen(false) }, tr('staleModal.cancel')),
              h('button', { type: 'button', className: 'spm-btn spm-btn-primary', onClick: () => void relocate() }, tr('btn.relocate')),
            ),
          ),
        )
      }

      return h('div', {
        className: 'spm-root',
        'data-screenplay-build': BUILD,
        ref: rootRef,
        style: {
          '--spm-line-height': String(typography.lineHeight),
          '--spm-block-gap': `${typography.blockGap}px`,
          '--spm-font-size': `${typography.fontSize}px`,
        },
      },
        renderHeader(),
        isStale && !pendingActive ? h('div', { className: 'spm-banner' },
          h('span', { className: 'spm-banner-text' }, tr('banner.stale')),
          h('button', { type: 'button', className: 'spm-btn', onClick: () => setStaleOpen(true) }, tr('btn.relocate')),
        ) : null,
        revisionReport !== null && revisionReport.outOfScope.length > 0 && !pendingActive ? h('div', { className: 'spm-banner' },
          h('span', { className: 'spm-banner-text' }, tr('banner.revisionOutOfScope', { n: revisionReport.outOfScope.length })),
          h('button', { type: 'button', className: 'spm-btn', onClick: () => setReportOpen(true) }, tr('btn.viewReport')),
          h('button', { type: 'button', className: 'spm-btn', onClick: () => void rollbackRevision() }, tr('btn.rollbackRevision')),
          h('button', { type: 'button', className: 'spm-btn', onClick: () => setRevisionReport(null) }, tr('btn.dismiss')),
        ) : null,
        h('div', {
          className: 'spm-body',
          ref: bodyRef,
          onMouseUp: handleSelectionMouseUp,
          onMouseDown: () => setBubble(null),
          onScroll: (event) => {
            setBubble(null)
            const target = event.currentTarget
            setShowBackToTop(target !== null && target !== undefined && target.scrollTop > 240)
          },
        }, renderBody()),
        showBackToTop ? h('button', {
          type: 'button',
          className: 'spm-backtop',
          title: tr('btn.backToTop'),
          'aria-label': tr('btn.backToTop'),
          onClick: () => {
            const body = bodyRef.current
            if (body !== null && typeof body.scrollTo === 'function') body.scrollTo({ top: 0, behavior: 'smooth' })
            setShowBackToTop(false)
          },
        }, '↑') : null,
        bubble !== null ? h('button', {
          type: 'button',
          className: 'spm-sel-bubble',
          style: { top: `${bubble.top}px`, left: `${bubble.left}px` },
          onMouseDown: (event) => event.preventDefault(),
          onClick: annotateSelection,
        }, `＋ ${tr('btn.annotateSelection')}`) : null,
        renderFooter(),
        toast !== '' ? h('div', { className: 'spm-toast', role: 'status' }, toast) : null,
        renderVersions(),
        renderToc(),
        renderTypography(),
        renderStale(),
        renderRevisionReport(),
      )
    }
    // ── plugin body ────────────────────────────────────────────────────────

    const inject = [
      'slots',
      'locale',
      'sidebarRightTabs',
      'remote',
      'remote.commands',
      'remote.workspaceFiles',
    ]

    function apply(ctx) {
      ctx.effect(() => ensureStyle(), 'screenplay: panel styles')

      ctx.effect(
        () => ctx.locale.register(NS, { zh, en }),
        'screenplay: dictionaries',
      )

      const t = ctx.locale.bind(NS)
      const helpers = createRemoteHelpers(ctx)

      // Optional jump-start for Desktop: when `剧本/.dsh-screenplay-open`
      // exists, the file it names is opened in this column as soon as a session
      // surface is on screen. No marker → nothing happens. This is how a fresh
      // app start can land directly in the screenplay panel.
      ctx.inject(['sidebarRight'], (sidebarCtx) => {
        const attempted = new Set()
        const attempting = new Set()
        const controller = new AbortController()
        let stopped = false
        let ticks = 0

        const container = (sidebarCtx === undefined || sidebarCtx === null ? undefined : sidebarCtx.sidebarRight) || ctx.sidebarRight
        if (container === undefined || typeof container.openResource !== 'function') return

        const pickAddress = async (sessionId) => {
          let marker = ''
          try {
            const result = await helpers.readDoc(sessionId, `${SCRIPT_DIR}/.dsh-screenplay-open`, controller.signal)
            marker = String(result.text === undefined || result.text === null ? '' : result.text).trim()
          } catch (error) {
            const code = error !== null && typeof error === 'object' ? error.code : undefined
            if (code === 'workspace-file/not-found' || code === 'workspace-file/not-regular-file' || code === 'workspace-file/not-text') {
              return 'absent'
            }
            return null
          }
          let entries = []
          try {
            const listing = await helpers.listScripts(sessionId, controller.signal)
            entries = listing.entries
          } catch {
            return null
          }
          if (entries.length === 0) return null
          let chosen
          if (marker !== '' && entries.some((entry) => entry.name === marker)) chosen = marker
          else chosen = entries[0].name
          if (chosen === undefined) return null
          return sessionFileAddress(sessionId, `${SCRIPT_DIR}/${chosen}`)
        }

        const tick = async () => {
          if (stopped) return
          let sessionId
          try {
            const store = container.mounted
            sessionId = store !== null && typeof store === 'object' && typeof store.getSnapshot === 'function'
              ? store.getSnapshot()
              : undefined
          } catch {
            return
          }
          if (typeof sessionId !== 'string' || attempted.has(sessionId) || attempting.has(sessionId)) return
          attempting.add(sessionId)
          try {
            const address = await pickAddress(sessionId)
            if (address === 'absent') {
              attempted.add(sessionId)
              return
            }
            if (typeof address !== 'string') return
            attempted.add(sessionId)
            // A plugin reload keeps the old tab body mounted (keepMounted), so a
            // plain reveal would show stale UI. Close the same tab first and let
            // the reopen mint a fresh occurrence with the current code.
            try {
              const active = typeof container.active === 'function' ? container.active() : undefined
              if (active !== undefined && active !== null && active.kind === KIND && active.contentId === address && typeof container.close === 'function') {
                container.close(active.id)
                await new Promise((resolve) => setTimeout(resolve, 300))
              }
            } catch {
              /* closing is best effort */
            }
            for (let tries = 0; tries < 8; tries += 1) {
              if (stopped) return
              try {
                container.openResource(address, {})
                stopped = true
                return
              } catch {
                await new Promise((resolve) => setTimeout(resolve, 500))
              }
            }
          } catch {
            /* auto-open is best effort */
          } finally {
            attempting.delete(sessionId)
          }
        }

        const timer = setInterval(() => {
          ticks += 1
          if (stopped || ticks > 600) {
            clearInterval(timer)
            return
          }
          void tick()
        }, 1500)
        ctx.effect(() => () => {
          stopped = true
          clearInterval(timer)
          controller.abort()
        }, 'screenplay: auto-open watcher')
        void tick()
      })

      ctx.effect(
        () => ctx.sidebarRightTabs.register({
          id: PACKAGE_ID,
          kind: KIND,
          priority: 'extension',
          patterns: ['*.md', '*.txt', '*.fountain'],
          canOpen(address) {
            const file = parseFileAddress(address)
            return file !== null && isScriptPath(file.path)
          },
          title(address) {
            const file = parseFileAddress(address)
            return file === null ? t('tab.title') : baseName(file.path)
          },
          keepMounted: true,
          guide: [
            {
              id: 'screenplay',
              title: () => t('tab.title'),
              description: () => t('tab.description'),
              order: 40,
            },
          ],
        }),
        'screenplay: right-sidebar tab type',
      )

      ctx.effect(
        () => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: PACKAGE_ID,
          locale: NS,
          inject: (sessionId) => ({
            sessionId,
            readDoc: (path, signal) => helpers.readDoc(sessionId, path, signal),
            readSidecar: (path, signal) => helpers.readSidecar(sessionId, path, signal),
            statDoc: (path, signal) => helpers.statDoc(sessionId, path, signal),
            listScripts: (signal) => helpers.listScripts(sessionId, signal),
            runCommand: (line) => helpers.runCommand(sessionId, line),
          }),
        }, ScreenplayPanel)),
        'screenplay: panel body',
      )

      ctx.effect(
        () => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab.title',
          key: PACKAGE_ID,
        }, (props) => {
          const info = props.useTabInfo()
          const file = parseFileAddress(info.tab.contentId)
          return h('span', null, file === null ? t('tab.title') : baseName(file.path))
        })),
        'screenplay: panel title',
      )
    }

    return { inject, apply }
  },
})
