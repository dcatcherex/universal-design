import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const projectKey = 'baan-yoo-dee.project.v2'
const legacyKey = 'baan-yoo-dee.project.v1'
const now = '2026-09-28T00:00:00.000Z'

function v1Envelope() {
  const m = (valueMm: number) => ({ valueMm, confidence: 'estimated' })
  const layout = {
    room: { width: m(6000), depth: m(5000), height: m(2700) },
    openings: [{ id: 'entry-door', kind: 'door', wall: 'north', offset: m(300), width: m(900), height: m(2100), sill: m(0), threshold: m(0), operation: 'hinged-in', hinge: 'start' }],
    items: [{ id: 'legacy-sofa', catalogId: 'sofa', label: 'Legacy sofa', center: { xMm: 3000, yMm: 4200 }, width: m(2100), depth: m(900), height: m(850), rotationDeg: 0, finish: 'sage', obstruction: 'solid' }],
    routes: [], turningAreas: [],
  }
  return {
    storageVersion: 1,
    writeToken: 'legacy-token',
    project: {
      schemaVersion: 1, id: 'legacy-recovery', title: 'Legacy recovery project', createdAt: now, updatedAt: now, revision: 2,
      household: { province: '', activities: [], mobilityAids: [], concerns: [], assistanceNotes: '', residentPreferences: '', budgetSatang: null },
      current: layout, proposed: null, targets: { routeWidth: null, turningDiameter: null }, recommendations: [],
      review: null,
    },
  }
}

test('corrupt v2 recovery leaves a valid v1 storage entry byte-identical', async ({ page }) => {
  const rawV1 = JSON.stringify(v1Envelope())
  const rawV2 = '{broken v2 bytes'
  await page.addInitScript(({ legacy, current }) => {
    localStorage.setItem('baan-yoo-dee.project.v1', legacy)
    localStorage.setItem('baan-yoo-dee.project.v2', current)
  }, { legacy: rawV1, current: rawV2 })
  await page.goto('/')
  const recovery = page.locator(".recovery-card")
  await expect(recovery).toBeVisible()
  const recoveryDownload = page.waitForEvent('download')
  await recovery.getByRole("button").first().click()
  expect(await readFile((await (await recoveryDownload).path())!, 'utf8')).toBe(rawV2)
  const storedLegacy = await page.evaluate((key) => localStorage.getItem(key), legacyKey)
  expect(storedLegacy).toBe(rawV1)
})

test('offers the exact corrupt saved bytes before a deliberate start over', async ({ page }) => {
  const raw = '{broken user data — keep for recovery'
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: projectKey, value: raw })
  await page.goto('/')
  const recovery = page.locator(".recovery-card")
  await expect(recovery).toBeVisible()
  const rawDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'ดาวน์โหลดข้อมูลที่บันทึกไว้' }).click()
  const download = await rawDownload
  expect(await readFile((await download.path())!, 'utf8')).toBe(raw)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'เริ่มโครงการใหม่' }).click()
  await expect(page.getByRole('heading', { name: 'โครงการใหม่' })).toBeVisible()
})

test('future-version and oversized imports leave the active project intact', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'เปิดตัวอย่างโครงการ' }).click()
  await page.getByLabel('หน้าแรก').click()
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({ name: 'future.udhome.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ schemaVersion: 3 })) })
  await expect(page.getByText('เปิดไฟล์โครงการนี้ไม่ได้ โครงการปัจจุบันยังไม่เปลี่ยนแปลง')).toBeVisible()
  await fileInput.setInputFiles({ name: 'large.udhome.json', mimeType: 'application/json', buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 32) })
  await expect(page.getByText('เปิดไฟล์โครงการนี้ไม่ได้ โครงการปัจจุบันยังไม่เปลี่ยนแปลง')).toBeVisible()
  await page.getByRole('button', { name: /ทำโครงการต่อ/ }).click()
  await expect(page.getByRole('heading', { name: /ตัวอย่างห้องนั่งเล่น/ })).toBeVisible()
  await expect(page.locator('.item-list .item-list-row')).toHaveCount(2)
})

test('quota failure preserves the in-memory project for download', async ({ page }) => {
  await page.addInitScript((key) => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (name: string, value: string) {
      if (name === key) throw new DOMException('Quota exceeded', 'QuotaExceededError')
      return original.call(this, name, value)
    }
  }, projectKey)
  await page.goto('/')
  await page.getByRole('button', { name: 'เปิดตัวอย่างโครงการ' }).click()
  await expect(page.locator('.project-menu-wrap .save-state')).toContainText('บันทึกไม่สำเร็จ', { timeout: 7000 })
  const projectDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'ไฟล์โครงการ' }).click()
  await page.getByRole('menuitem', { name: 'ดาวน์โหลดไฟล์โครงการ', exact: true }).click()
  const download = await projectDownload
  const project = JSON.parse(await readFile((await download.path())!, 'utf8')) as { title: string; current: { floors: { rooms: { items: unknown[] }[] }[] } }
  expect(project.title).toMatch(/ตัวอย่างห้องนั่งเล่น/)
  expect(project.current.floors[0].rooms[0].items).toHaveLength(2)
})

test('storage conflict offers a download of this tab’s still-live project', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'เปิดตัวอย่างโครงการ' }).click()
  await expect(page.locator('.project-menu-wrap .save-state')).toHaveText('บันทึกบนอุปกรณ์นี้แล้ว', { timeout: 7000 })
  await page.evaluate((key) => {
    const envelope = JSON.parse(localStorage.getItem(key)!)
    envelope.writeToken = 'another-tab-token'
    envelope.project.title = 'ชื่อจากแท็บอื่น'
    localStorage.setItem(key, JSON.stringify(envelope))
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(envelope) }))
  }, projectKey)
  await expect(page.locator('.project-menu-wrap .save-state')).toContainText('อีกแท็บหนึ่ง', { timeout: 5000 })
  await page.getByLabel('หน้าแรก').click()
  await expect(page.getByRole('status').filter({ hasText: /อีกแท็บหนึ่ง/ })).toBeVisible()
  const currentDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'ดาวน์โหลดไฟล์โครงการ' }).click()
  const download = await currentDownload
  const project = JSON.parse(await readFile((await download.path())!, 'utf8')) as { title: string }
  expect(project.title).toMatch(/ตัวอย่างห้องนั่งเล่น/)
})

test('cancels an old pending autosave when replacing its project', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-28T00:00:00.000Z') })
  await page.goto('/')
  await page.getByRole('button', { name: 'เปิดตัวอย่างโครงการ' }).click()
  await page.getByLabel('หน้าแรก').click()
  await page.getByRole('button', { name: 'สร้างโครงการใหม่' }).click()
  await page.getByLabel('ชื่อโครงการ').fill('โครงการแทนที่')
  await page.getByRole('button', { name: 'เริ่มโครงการ' }).click()
  await page.clock.fastForward(501)
  const project = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).project, projectKey) as { title: string }
  expect(project.title).toBe('โครงการแทนที่')
})
