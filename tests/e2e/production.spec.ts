import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test.skip(process.env.PLAYWRIGHT_PRODUCTION !== '1', 'run against the production server only')

test('serves the built app without hydration errors and keeps project exports working', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'เปิดตัวอย่างโครงการ' })).toBeVisible()
  await page.getByRole('button', { name: 'เปิดตัวอย่างโครงการ' }).click()
  await expect(page.getByRole('heading', { name: /ตัวอย่างห้องนั่งเล่น/ })).toBeVisible()
  const svgDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'ส่งออก' }).click()
  await page.getByRole('menuitem', { name: 'ดาวน์โหลดแผนปัจจุบันเป็น SVG' }).click()
  const download = await svgDownload
  const svg = await readFile((await download.path())!, 'utf8')
  expect(svg.startsWith('<?xml')).toBe(true)
  expect(svg).toContain('<svg')
  expect(pageErrors).toEqual([])
})
