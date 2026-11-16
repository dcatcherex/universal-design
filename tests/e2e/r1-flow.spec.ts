import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const now = '2026-09-28T00:00:00.000Z'
const m = (valueMm: number) => ({ valueMm, confidence: 'estimated' })

/** A project file exactly as v1 wrote it. */
function v1File() {
  const layout = {
    room: { width: m(6000), depth: m(5000), height: m(2700) },
    openings: [{ id: 'entry-door', kind: 'door', wall: 'north', offset: m(300), width: m(900), height: m(2100), sill: m(0), threshold: m(0), operation: 'hinged-in', hinge: 'start' }],
    items: [{ id: 'sofa-1', catalogId: 'sofa', label: 'โซฟาเดิม', center: { xMm: 3000, yMm: 4200 }, width: m(2100), depth: m(900), height: m(850), rotationDeg: 0, finish: 'sage', obstruction: 'solid' }],
    routes: [], turningAreas: [],
  }
  return {
    schemaVersion: 1, id: 'v1-file', title: 'โครงการรุ่นหนึ่ง', createdAt: now, updatedAt: now, revision: 2,
    household: { province: 'เชียงใหม่', activities: [], mobilityAids: [], concerns: [], assistanceNotes: '', residentPreferences: '', budgetSatang: null },
    current: layout, proposed: null, targets: { routeWidth: null, turningDiameter: null }, recommendations: [],
    review: { reviewerName: 'ผู้ทบทวนเดิม', reviewedAt: now, projectRevision: 2 },
  }
}

async function openBathroomExample(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'เปิดตัวอย่างห้องน้ำ' }).click()
  await expect(page.getByRole('heading', { name: /ตัวอย่างห้องน้ำ/ })).toBeVisible()
}

const check = (page: Page, ruleId: string) => page.locator(`.inspector-sidebar [data-testid="check-result"][data-rule-id="${ruleId}"]`)

test('upgrades a v1 project file and a v1 saved project without touching the old data', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles({ name: 'old.udhome.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(v1File())) })
  await expect(page.getByRole('heading', { name: 'โครงการรุ่นหนึ่ง' })).toBeVisible()
  await expect(page.locator('.item-list').getByRole('button', { name: /โซฟาเดิม/ })).toBeVisible()
  await expect(page.locator('[data-item-id="sofa-1"]')).toHaveAttribute('data-x-mm', '3000')
  // The old review covered checks without benchmarks, so it shows as outdated.
  await page.getByRole('button', { name: 'ผู้ให้คำปรึกษา' }).click()
  await page.getByRole('tab', { name: 'ข้อเสนอแนะ' }).click()
  await expect(page.locator('.review-panel')).toContainText('การทบทวนไม่เป็นปัจจุบัน')

  // The same project saved by v1 in the browser opens on the next visit, and its entry is left alone.
  const legacy = JSON.stringify({ storageVersion: 1, writeToken: 'old-token', project: v1File() })
  await page.evaluate((value) => { localStorage.clear(); localStorage.setItem('baan-yoo-dee.project.v1', value) }, legacy)
  await page.reload()
  await expect(page.getByText(/ถูกปรับรุ่นจากเวอร์ชันก่อนหน้า/)).toBeVisible()
  await page.getByRole('button', { name: /ทำโครงการต่อ/ }).click()
  await expect(page.getByRole('status').filter({ hasText: /ถูกปรับรุ่นจากเวอร์ชันก่อนหน้า/ })).toBeVisible()
  await page.locator('.item-list').getByRole('button', { name: /โซฟาเดิม/ }).click()
  await page.getByLabel('ตำแหน่ง X (ซม.)').fill('310')
  await expect(page.locator('.project-menu-wrap .save-state')).toHaveText('บันทึกบนอุปกรณ์นี้แล้ว', { timeout: 7000 })
  const stored = await page.evaluate(() => ({ v1: localStorage.getItem('baan-yoo-dee.project.v1'), v2: localStorage.getItem('baan-yoo-dee.project.v2') }))
  expect(stored.v1).toBe(legacy)
  expect(JSON.parse(stored.v2!).project.schemaVersion).toBe(2)
})

test('shows both benchmarks for the bathroom example and never a definite verdict', async ({ page }) => {
  await openBathroomExample(page)
  await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  await expect(page.getByTestId('benchmark-banner').first()).toContainText('2026.10-draft')
  for (const ruleId of ['D01', 'D03', 'B01', 'B02', 'B03']) await expect(check(page, ruleId)).toHaveAttribute('data-check-status', 'attention')
  await expect(check(page, 'B05')).toHaveAttribute('data-check-status', 'not-evaluated')
  await expect(check(page, 'B03')).toContainText('ยังไม่มีราวจับ')

  const doorWidth = check(page, 'D01')
  await expect(doorWidth.getByTestId('verdict')).toHaveCount(2)
  await expect(doorWidth.locator('[data-benchmark="th-public-building"]')).toContainText('ข้อ 18(3)')
  await expect(doorWidth.locator('[data-benchmark="th-public-building"]')).toContainText('น่าจะไม่เป็นไปตามเกณฑ์')
  await expect(doorWidth.locator('[data-benchmark="th-dop-home"]')).toContainText('คำแนะนำสำหรับบ้าน')
  await expect(doorWidth).toContainText('ให้ผู้เชี่ยวชาญตรวจสอบ')
  // "No benchmark value" is shown as such, not as a failure.
  await expect(check(page, 'B02').locator('[data-key="toilet.seatHeight"][data-benchmark="th-dop-home"]')).toHaveAttribute('data-outcome', 'no-value')
  await expect(page.locator('.inspector-sidebar [data-outcome="meets"], .inspector-sidebar [data-outcome="does-not-meet"]')).toHaveCount(0)
  await expect(page.locator('.inspector-sidebar .checks-disclaimer')).toContainText('ไม่ใช่การรับรอง')

  const axe = await new AxeBuilder({ page }).include('.inspector-sidebar').analyze()
  expect(axe.violations).toEqual([])
  await page.screenshot({ path: path.resolve('docs/handoff/evidence/r1-bathroom-2d.png') })
})

test('an advisor chooses the primary benchmark, which changes results and outdates the review', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'เปิดตัวอย่างโครงการ' }).click()
  await page.getByRole('button', { name: 'แก้ไขห้องปัจจุบัน' }).click()
  // Narrow the door to 870 mm: it meets the public-building width (860) but not the home one (900).
  await page.getByRole('button', { name: /^แก้ไข: ประตู/ }).click()
  const width = page.getByLabel('ความกว้างสุทธิของช่องเปิด (ซม.)', { exact: true })
  await width.fill('87')
  await width.press('Enter')
  await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  await expect(check(page, 'D01')).toHaveAttribute('data-check-status', 'attention')

  await page.getByRole('button', { name: 'ผู้ให้คำปรึกษา' }).click()
  await page.getByRole('tab', { name: 'ข้อเสนอแนะ' }).click()
  await page.getByLabel('ชื่อผู้ทบทวน (กรอกเอง)').fill('ผู้ทบทวน')
  await page.getByRole('button', { name: 'บันทึกการทบทวนสำหรับฉบับนี้' }).click()
  await expect(page.locator('.review-panel')).toContainText('ทบทวนฉบับปัจจุบันแล้ว')

  await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  const policy = page.locator('.inspector-sidebar .benchmark-policy')
  await policy.getByLabel('เกณฑ์หลัก', { exact: true }).selectOption('th-public-building')
  await policy.getByLabel('ผู้เลือกเกณฑ์').fill('ที่ปรึกษาทดสอบ')
  await policy.getByRole('button', { name: 'บันทึกเกณฑ์หลัก' }).click()
  await expect(check(page, 'D01')).toHaveAttribute('data-check-status', 'clear')
  await page.getByRole('tab', { name: 'ข้อเสนอแนะ' }).click()
  await expect(page.locator('.review-panel')).toContainText('การทบทวนไม่เป็นปัจจุบัน')
})

test('previews and applies a fix as one undoable step', async ({ page }) => {
  await openBathroomExample(page)
  await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  await check(page, 'B01').locator('[data-fix-id="door-rehang-out"]').click()
  const preview = page.getByTestId('fix-preview')
  await expect(preview).toContainText('ระบบจะสร้างห้องหลังปรับปรุงจากห้องปัจจุบัน')
  await expect(preview.locator('[data-rule-id="B01"]')).toHaveAttribute('data-to', 'clear')
  await expect(preview).toContainText('ยังไม่มีราคาตั้งต้น')
  // Nothing is committed while the preview is open.
  await expect(page.getByRole('button', { name: 'หลังปรับปรุง' })).toHaveCount(0)
  const axe = await new AxeBuilder({ page }).include('[data-testid="fix-preview"]').analyze()
  expect(axe.violations).toEqual([])
  await preview.getByRole('button', { name: 'ใช้แนวทางนี้' }).click()

  await page.getByRole('button', { name: 'หลังปรับปรุง' }).click()
  await expect(check(page, 'B01')).toHaveAttribute('data-check-status', 'clear')
  await page.getByRole('tab', { name: 'ข้อเสนอแนะ' }).click()
  await expect(page.locator('.inspector-sidebar .recommendation-card')).toHaveCount(1)
  await expect(page.locator('.inspector-sidebar .recommendation-card')).toContainText('กลับบานประตูให้เปิดออกด้านนอก')
  await expect(page.locator('.inspector-sidebar .recommendation-card')).toContainText('ยังไม่ทราบค่าใช้จ่าย')

  await page.getByRole('button', { name: 'เลิกทำ' }).click()
  await expect(page.getByRole('button', { name: 'หลังปรับปรุง' })).toHaveCount(0)
  await expect(page.locator('.inspector-sidebar .recommendation-card')).toHaveCount(0)
})

test('adds a grab bar in the wall view and moves it by keyboard and by number', async ({ page }) => {
  await openBathroomExample(page)
  await page.getByRole('button', { name: 'มุมมองผนัง', exact: true }).click()
  await page.getByRole('button', { name: 'ผนังด้านตะวันออก', exact: true }).click()
  await page.getByRole('button', { name: 'เพิ่มบนผนังนี้' }).click()
  const bar = page.locator('.elevation-fixture')
  await expect(bar).toHaveCount(1)
  await expect(bar).toHaveAttribute('data-height-mm', '800')
  // Its benchmark band is drawn while it is selected; only the public-building benchmark has one.
  await expect(page.getByTestId('benchmark-band')).toHaveCount(1)
  await expect(page.getByTestId('benchmark-band')).toContainText('65–70')

  // Keyboard: 10 mm per press, 50 mm with Shift. 800 → 700 → 680.
  await bar.focus()
  await bar.press('Shift+ArrowDown')
  await bar.press('Shift+ArrowDown')
  await bar.press('ArrowDown')
  await bar.press('ArrowDown')
  await expect(bar).toHaveAttribute('data-height-mm', '680')
  await bar.press('Shift+ArrowRight')
  await expect(bar).toHaveAttribute('data-offset-mm', '950')

  // Number: the inspector shows the same values and accepts a new offset.
  const height = page.getByLabel('ระดับจุดอ้างอิงจากพื้น (ซม.)', { exact: true })
  await expect(height).toHaveValue('68')
  const offset = page.getByLabel('ระยะกึ่งกลางจากจุดเริ่มผนัง (ซม.)', { exact: true })
  await offset.fill('110')
  await offset.press('Enter')
  await expect(bar).toHaveAttribute('data-offset-mm', '1100')
  // A position off the wall is refused with a reason and nothing changes.
  await offset.fill('175')
  await offset.press('Enter')
  await expect(page.getByText('ตำแหน่งนี้อยู่นอกแนวผนังหรือสูงเกินเพดาน')).toBeVisible()
  await expect(bar).toHaveAttribute('data-offset-mm', '1100')
  await page.screenshot({ path: path.resolve('docs/handoff/evidence/r1-wall-elevation.png') })

  // Drag: down by about a third of the wall height.
  const box = (await bar.locator('.elevation-shape').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40, { steps: 5 })
  await page.mouse.up()
  expect(Number(await bar.getAttribute('data-height-mm'))).toBeLessThan(680)
  await page.getByRole('button', { name: 'เลิกทำ' }).click()
  await expect(bar).toHaveAttribute('data-height-mm', '680')

  // The plan shows the same fixture on the same wall, and the grab bar check now finds it.
  await page.getByRole('button', { name: 'แผนผัง 2 มิติ' }).click()
  const symbol = page.locator('.plan-fixture')
  await expect(symbol).toHaveAttribute('data-wall', 'east')
  await expect(symbol).toHaveAttribute('data-offset-mm', '1100')
  await expect(symbol).toHaveAttribute('data-height-mm', '680')
  await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  await expect(check(page, 'B03')).not.toContainText('ยังไม่มีราวจับ')

  // 3D draws it too.
  await page.getByRole('button', { name: 'มุมมอง 3 มิติ' }).click()
  await expect(page.getByTestId('room-scene-canvas')).toBeVisible()
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.resolve('docs/handoff/evidence/r1-bathroom-3d.png') })

  // Undo all the way back removes the fixture.
  await page.getByRole('button', { name: 'แผนผัง 2 มิติ' }).click()
  for (let step = 0; step < 8 && await page.getByRole('button', { name: 'เลิกทำ' }).isEnabled(); step++) await page.getByRole('button', { name: 'เลิกทำ' }).click()
  await expect(page.locator('.plan-fixture')).toHaveCount(0)
})

test('records the resident, marks a fall, and keeps health data out of the report by default', async ({ page }) => {
  await page.addInitScript(() => { window.print = () => undefined })
  await openBathroomExample(page)
  await page.getByRole('tab', { name: 'ผู้อยู่อาศัย' }).click()
  const resident = page.locator('.inspector-sidebar .resident-panel')
  await expect(resident).toContainText('ข้อมูลสุขภาพ')
  const chairWidth = resident.getByLabel('ความกว้างรวมของรถเข็น (ซม.)', { exact: true })
  await chairWidth.fill('75')
  await chairWidth.press('Enter')
  const axe = await new AxeBuilder({ page }).include('.resident-panel').analyze()
  expect(axe.violations).toEqual([])

  await resident.getByRole('button', { name: 'เพิ่มการหกล้ม' }).click()
  await resident.getByLabel('บันทึกเพิ่มเติมเกี่ยวกับการหกล้ม (ไม่บังคับ)').fill('ลื่นตอนกลางคืน')
  await resident.getByLabel('บันทึกเพิ่มเติมเกี่ยวกับการหกล้ม (ไม่บังคับ)').blur()
  // With no location, every problem in the room counts as near the fall.
  await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  await expect(check(page, 'D01')).toHaveAttribute('data-near-fall', 'true')
  // The 700 mm door is narrower than the 750 mm wheelchair.
  await expect(check(page, 'H03')).toHaveAttribute('data-check-status', 'attention')
  await expect(check(page, 'H03')).toContainText('ไม่ได้เผื่อระยะสำหรับมือ')

  // Mark the fall beside the toilet: now only nearby results are flagged, and they come first.
  await page.getByRole('tab', { name: 'ผู้อยู่อาศัย' }).click()
  await resident.getByRole('button', { name: 'ระบุบนแผนผัง' }).click()
  const plan = page.locator('svg[aria-label^="แผนผังห้อง"]')
  const box = (await plan.boundingBox())!
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.6)
  await expect(page.locator('.fall-marker')).toHaveCount(1)
  await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  await expect(check(page, 'B02')).toHaveAttribute('data-near-fall', 'true')
  await expect(check(page, 'B03')).toHaveAttribute('data-near-fall', 'true')
  await expect(check(page, 'D01')).toHaveAttribute('data-near-fall', 'false')
  await expect(page.locator('.inspector-sidebar [data-testid="check-result"]').first()).toHaveAttribute('data-near-fall', 'true')
  await expect(check(page, 'B02')).toContainText('ใกล้จุดที่เคยหกล้ม')

  // Export warns about health data; declining does not download.
  let warned = ''
  page.once('dialog', (dialog) => { warned = dialog.message(); void dialog.dismiss() })
  await page.getByRole('button', { name: 'ไฟล์โครงการ' }).click()
  await page.getByRole('menuitem', { name: 'ดาวน์โหลดไฟล์โครงการ' }).click()
  await expect.poll(() => warned).toContain('ข้อมูลสุขภาพ')
  const download = page.waitForEvent('download')
  page.once('dialog', (dialog) => { void dialog.accept() })
  await page.getByRole('button', { name: 'ไฟล์โครงการ' }).click()
  await page.getByRole('menuitem', { name: 'ดาวน์โหลดไฟล์โครงการ' }).click()
  const saved = JSON.parse(await readFile((await (await download).path())!, 'utf8')) as { schemaVersion: number; resident: { wheelchair: { width: { valueMm: number } }; falls: { note: string; point: unknown }[] } }
  expect(saved.schemaVersion).toBe(2)
  expect(saved.resident.wheelchair.width.valueMm).toBe(750)
  expect(saved.resident.falls[0].note).toBe('ลื่นตอนกลางคืน')
  expect(saved.resident.falls[0].point).not.toBeNull()

  // Report: both benchmarks, version and disclaimer; fall history only when included.
  await page.getByRole('button', { name: 'ส่งออก' }).click()
  await page.getByRole('menuitem', { name: 'ดูตัวอย่างรายงานสำหรับพิมพ์' }).click()
  const report = page.getByRole('dialog', { name: 'รายงานการปรับบ้าน' })
  await expect(report).toContainText('2026.10-draft')
  await expect(report).toContainText('ไม่ใช่การรับรอง')
  await expect(report.locator('.report-verdicts').first()).toContainText('ข้อ 18(3)')
  await expect(report.locator('.report-verdicts').first()).toContainText('คำแนะนำสำหรับบ้าน')
  await expect(report).toContainText('รายงานนี้ไม่ได้แสดงประวัติการหกล้ม')
  await expect(report).not.toContainText('ลื่นตอนกลางคืน')
  await report.getByLabel('แสดงประวัติการหกล้มในรายงานนี้').check()
  await expect(report).toContainText('ลื่นตอนกลางคืน')
  const reportAxe = await new AxeBuilder({ page }).include('.report-document').analyze()
  expect(reportAxe.violations).toEqual([])
  await page.getByRole('button', { name: 'พิมพ์ / บันทึกเป็น PDF' }).click()
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: path.resolve('docs/handoff/evidence/r1-report.pdf'), printBackground: true, preferCSSPageSize: true })
})

test('creates a new bathroom project and keeps bathroom pieces out of a living room', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'สร้างโครงการใหม่' }).click()
  await page.getByLabel('ประเภทห้อง').selectOption('bathroom')
  await expect(page.getByLabel('กว้าง (ม.)')).toHaveValue('2')
  await page.getByLabel('จังหวัด (ไม่บังคับ)').selectOption({ label: 'เชียงใหม่' })
  await page.getByLabel('ชื่อโครงการ').fill('ห้องน้ำคุณยาย')
  await page.getByRole('button', { name: 'เริ่มโครงการ' }).click()
  await expect(page.locator('.canvas-caption')).toContainText('2.00 × 1.80 m')
  const catalog = page.locator('.catalog-sidebar')
  await expect(catalog.getByRole('button', { name: /^โถส้วมนั่งราบ,/ })).toBeVisible()
  await expect(catalog.getByRole('button', { name: /^โซฟา,/ })).toHaveCount(0)

  await catalog.getByRole('button', { name: /^โถส้วมนั่งยอง,/ }).click()
  const plan = page.locator('svg[aria-label^="แผนผังห้อง"]')
  const box = (await plan.boundingBox())!
  await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.6)
  await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  // A squat toilet does not meet the home recommendation for type, and has no seat height to compare.
  await expect(check(page, 'B02')).toHaveAttribute('data-check-status', 'attention')
  await expect(check(page, 'B02').locator('[data-key="toilet.seatHeight"]').first()).toHaveAttribute('data-outcome', 'no-value')
  await expect(check(page, 'B02').locator('[data-fix-id="replace-seated-toilet"]')).toBeVisible()

  // At phone width the wall view still fits and its wall selector is reachable.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'มุมมองผนัง', exact: true }).click()
  await expect(page.getByRole('button', { name: 'ผนังด้านตะวันออก', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
