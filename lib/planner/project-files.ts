import { validateProject } from './schema'
import type { Project, Result } from './types'

export const MAX_PROJECT_FILE_BYTES = 2 * 1024 * 1024

function failure(code: string, messageKey: string, paths: string[] = []): Result<Project> {
  return { ok: false, error: { code, messageKey, paths } }
}

export function encodeProject(project: Project): string {
  const validation = validateProject(project)
  if (!validation.ok) throw new Error(`Invalid project: ${validation.error.paths.join(', ')}`)
  return JSON.stringify(validation.value, null, 2)
}

export function decodeProject(text: string): Result<Project> {
  if (new TextEncoder().encode(text).byteLength > MAX_PROJECT_FILE_BYTES) return failure('project-too-large', 'project.fileTooLarge', ['file'])
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return failure('invalid-json', 'project.invalidJson', ['file'])
  }
  if (typeof parsed === 'object' && parsed !== null && 'schemaVersion' in parsed && typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > 1) {
    return failure('future-version', 'project.futureVersion', ['schemaVersion'])
  }
  const validation = validateProject(parsed)
  if (!validation.ok) return { ok: false, error: { ...validation.error, code: 'invalid-project' } }
  return validation
}

export function projectFilename(title: string): string {
  const safeTitle = title.trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .slice(0, 120)
  return `${safeTitle || 'home-adaptation'}.udhome.json`
}

export function downloadTextFile(filename: string, content: string, mimeType = 'application/json;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
