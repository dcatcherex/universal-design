import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const projectKey = 'baan-yoo-dee.project.v1'

test('offers the exact corrupt saved bytes before a deliberate start over', async ({ page }) => {
  const raw = '{broken user data — keep for recovery'
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: projectKey, value: raw })
  await page.goto('/')
  await expect(page.getByRole('alert').filter({ hasText: /ข้อมูลที่บันทึกไว้/ })).toBeVisible()
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
  await fileInput.setInputFiles({ name: 'future.udhome.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ schemaVersion: 2 })) })
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
  await page.getByRole('menuitem', { name: 'ดาวน์โหลดไฟล์โครงการ' }).click()
  const download = await projectDownload
  const project = JSON.parse(await readFile((await download.path())!, 'utf8')) as { title: string; current: { items: unknown[] } }
  expect(project.title).toMatch(/ตัวอย่างห้องนั่งเล่น/)
  expect(project.current.items).toHaveLength(2)
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
