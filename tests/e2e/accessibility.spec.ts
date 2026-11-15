import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

async function expectAccessible(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  if (results.violations.length) {
    await test.info().attach(`${name}-axe-violations.json`, { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' })
    for (const violation of results.violations) console.log(`${name} ${violation.id}: ${violation.nodes.map((node) => `${node.html} ${node.failureSummary?.replace(/\s+/g, ' ')}`).join(' | ')}`)
  }
  expect(results.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map((node) => ({ html: node.html, summary: node.failureSummary })) })), `${name} accessibility violations`).toEqual([])
}

test('passes axe checks on welcome, setup, editor, checks, recommendation and report states', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await expectAccessible(page, 'Thai welcome')
  await page.getByRole('button', { name: 'สร้างโครงการใหม่' }).click()
  await expectAccessible(page, 'Thai project setup')
  await page.getByRole('button', { name: 'กลับ' }).click()
  await page.getByRole('button', { name: 'เปิดตัวอย่างโครงการ' }).click()
  await expectAccessible(page, 'Thai editor')
  await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  await expectAccessible(page, 'Thai geometry checks')
  await page.locator('[data-rule-id="G04"][data-check-status="attention"]').getByRole('button', { name: 'สร้างร่างข้อเสนอแนะ' }).click()
  await expectAccessible(page, 'Thai recommendation draft')
  await page.locator('.recommendation-editor').getByRole('button', { name: 'ยกเลิกการแก้ไข' }).click()
  await page.getByRole('button', { name: 'ผู้ให้คำปรึกษา' }).click()
  await expectAccessible(page, 'Thai advisor checks')
  await page.getByRole('button', { name: 'ส่งออก' }).click()
  await page.getByRole('menuitem', { name: 'ดูตัวอย่างรายงานสำหรับพิมพ์' }).click()
  await expectAccessible(page, 'Thai printable report')
})

test('keeps Thai and English welcome/editor layouts within narrow, tablet and desktop viewports', async ({ page }) => {
  for (const locale of ['th', 'en'] as const) {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : width === 768 ? 1024 : 900 })
      await page.goto('/')
      await page.evaluate(() => localStorage.clear())
      await page.reload()
      if (locale === 'en') await page.getByRole('button', { name: 'EN', exact: true }).click()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.getByRole('button', { name: locale === 'th' ? 'เปิดตัวอย่างโครงการ' : 'Open fictional example' }).click()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      if (width === 390) {
        if (locale === 'th') await page.screenshot({ path: 'docs/handoff/evidence/m4-thai-mobile.png', fullPage: true })
        const actions = page.getByRole('navigation', { name: locale === 'th' ? 'การทำงานบนมือถือ' : 'Mobile actions' })
        await expect(actions).toBeVisible()
        await page.getByRole('button', { name: locale === 'th' ? 'เพิ่มสิ่งของ' : 'Add an item' }).click()
        const sheet = page.getByRole('dialog')
        await expect(sheet).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(sheet).toHaveCount(0)
        await expect(page.getByRole('button', { name: locale === 'th' ? 'เพิ่มสิ่งของ' : 'Add an item' })).toBeFocused()
      }
    }
  }
})

test('supports Thai-digit geometry input, ordinary text arrow keys, Escape and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'เปิดตัวอย่างโครงการ' }).click()
  await page.getByRole('button', { name: 'หลังปรับปรุง' }).click()
  const tableRow = page.locator('.item-list').getByRole('button', { name: /โต๊ะกลาง/ })
  await tableRow.click()
  const xInput = page.getByLabel('ตำแหน่ง X (ซม.)')
  await xInput.fill('๓๕๐')
  await expect(page.locator('[data-item-id="coffee-table-1"]')).toHaveAttribute('data-x-mm', '3500')
  await xInput.focus()
  await xInput.press('ArrowLeft')
  await expect(page.locator('[data-item-id="coffee-table-1"]')).toHaveAttribute('data-x-mm', '3500')
  await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  await page.getByRole('button', { name: 'วาดบนแผนผัง' }).click()
  await expect(page.getByText(/กดตำแหน่งบนแผนผัง/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText(/กดตำแหน่งบนแผนผัง/)).toHaveCount(0)
})

test('keeps setup and editing usable at the 720px layout width used to check 200% zoom', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'สร้างโครงการใหม่' }).click()
  await page.getByLabel('ชื่อโครงการ').fill('ทดสอบการขยายหน้าจอ')
  await page.getByRole('button', { name: 'เริ่มโครงการ' }).click()
  await expect(page.locator('.canvas-caption')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'การทำงานบนมือถือ' })).toBeVisible()
  await page.getByRole('button', { name: 'เพิ่มสิ่งของ' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('button', { name: 'โต๊ะกลาง, 1100 × 600 × 450 mm' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(720)
})
