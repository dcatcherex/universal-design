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

async function openLivingExample(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'เปิดตัวอย่างโครงการ' }).click()
}

const check = (page: Page, ruleId: string) => page.locator(`.inspector-sidebar [data-testid="check-result"][data-rule-id="${ruleId}"]`)

test('previews route check feedback while moving furniture and Escape restores it without a commit', async ({ page }) => {
  await openLivingExample(page)
  const item = page.locator('[data-item-id="coffee-table-1"]')
  const route = page.locator('[data-overlay-id="example-route"]')
  await expect(route).toHaveAttribute('data-entity-check-status', 'attention')
  await expect(page.getByRole('button', { name: 'เลิกทำ' })).toBeDisabled()
  const box = await item.boundingBox()
  if (!box) throw new Error('Coffee table is not visible')
  const destination = await page.locator('.canvas-stage svg').evaluate((node) => {
    const svg = node as SVGSVGElement
    const point = svg.createSVGPoint()
    point.x = 3000
    point.y = 1800
    const screen = point.matrixTransform(svg.getScreenCTM()!)
    return { x: screen.x, y: screen.y }
  })
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(destination.x, destination.y, { steps: 8 })
  await expect(item).toHaveAttribute('data-y-mm', '1800')
  await expect(route).toHaveAttribute('data-entity-check-status', 'clear')
  await expect(item).toHaveAttribute('data-entity-check-status', 'clear')
  await expect(page.getByTestId('move-check-chip')).toContainText('ไม่พบผลตรวจที่ต้องใส่ใจ')
  await expect(page.getByTestId('move-check-live')).toContainText('ไม่พบผลตรวจที่ต้องใส่ใจ')
  await page.screenshot({ path: path.resolve('docs/handoff/evidence/r1-live-move.png') })
  await expect(page.getByRole('button', { name: 'เลิกทำ' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(item).toHaveAttribute('data-y-mm', '500')
  await expect(route).toHaveAttribute('data-entity-check-status', 'attention')
  await expect(item).toHaveAttribute('data-entity-check-status', 'attention')
  await expect(page.getByTestId('move-check-chip')).toHaveCount(0)
  await page.mouse.up()
  await expect(page.getByRole('button', { name: 'เลิกทำ' })).toBeDisabled()
  await page.getByRole('button', { name: 'หลังปรับปรุง' }).click()
  await item.focus()
  await page.keyboard.down('Shift')
  for (let step = 0; step < 11; step++) await page.keyboard.down('ArrowUp')
  await expect(item).toHaveAttribute('data-y-mm', '1250')
  await expect(route).toHaveAttribute('data-entity-check-status', 'attention')
  await expect(page.getByTestId('move-check-chip')).toContainText('ผลตรวจที่ต้องใส่ใจ')
  await expect(page.getByTestId('move-check-live')).toContainText('ผลตรวจที่ต้องใส่ใจ')
  await page.keyboard.up('ArrowUp')
  await page.keyboard.up('Shift')
  await expect(page.getByRole('button', { name: 'เลิกทำ' })).toBeEnabled()
})

test('upgrades a v1 project file and a v1 saved project without touching the old data', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles({ name: 'old.udhome.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(v1File())) })
  await expect(page.getByRole('heading', { name: 'โครงการรุ่นหนึ่ง' })).toBeVisible()
  await expect(page.locator('.item-list').getByRole('button', { name: /โซฟาเดิม/ })).toBeVisible()
  await expect(page.locator('[data-item-id="sofa-1"]')).toHaveAttribute('data-x-mm', '3000')
  // The old review covered checks without benchmarks, so it shows as outdated.
  await page.getByRole('button', { name: 'ผู้ให้คำปรึกษา' }).click()
  await page.getByRole('tab', { name: 'ข้อเสนอแนะ' }).click()
  await expect(page.locator('.review-panel')).toContainText('การทบทวนเป็นข้อมูลเก่า')

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
  const counts = page.locator('.inspector-sidebar .checks-counts')
  const total = Number(await counts.getAttribute('data-total'))
  const attention = Number(await counts.locator('[data-check-filter="attention"]').getAttribute('data-count'))
  await expect(page.locator('.inspector-sidebar [data-testid="check-result"]')).toHaveCount(total)
  await expect(page.locator('.inspector-sidebar [data-testid="check-result"][data-check-status="attention"]')).toHaveCount(attention)
  await counts.locator('[data-check-filter="notEvaluated"]').click()
  await expect(page.locator('.inspector-sidebar [data-testid="check-result"]')).toHaveCount(Number(await counts.locator('[data-check-filter="notEvaluated"]').getAttribute('data-count')))
  await counts.locator('[data-check-filter="all"]').click()

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

test('shows synchronized check marks, navigates to a result, and persists the mark toggle', async ({ page }) => {
  await openBathroomExample(page)
  const plan = page.locator('.canvas-stage svg')
  const doorBadge = plan.locator('[data-check-entity-id="bathroom-door"]')
  const toiletBadge = plan.locator('[data-check-entity-id="toilet-1"]')
  const jarBadge = plan.locator('[data-check-entity-id="water-jar-1"]')
  await expect(doorBadge).toHaveAttribute('data-check-mark', 'attention')
  await expect(toiletBadge).toHaveAttribute('data-check-mark', 'attention')
  await expect(jarBadge).toHaveAttribute('data-check-mark', 'attention')

  await plan.locator('[data-item-id="water-jar-1"]').click()
  const jarCoordinates = page.locator('.inspector-sidebar .item-inspector input')
  await jarCoordinates.nth(0).fill('150')
  await jarCoordinates.nth(1).fill('40')
  await expect(jarBadge).toHaveCount(0)

  const toiletResultId = await toiletBadge.getAttribute('data-result-id')
  await toiletBadge.click()
  await expect(page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator(`[data-check-result-id="${toiletResultId}"]`)).toBeVisible()

  const hideMarks = page.getByRole('button', { name: 'เครื่องหมายผลตรวจ: แสดง' })
  await expect(hideMarks).toHaveAttribute('aria-pressed', 'true')
  await hideMarks.click()
  await expect(plan.locator('[data-check-mark]')).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: /ทำโครงการต่อ/ }).click()
  await expect(page.getByRole('button', { name: 'เครื่องหมายผลตรวจ: ซ่อน' })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.canvas-stage svg [data-check-mark]')).toHaveCount(0)

  await page.getByRole('button', { name: 'เครื่องหมายผลตรวจ: ซ่อน' }).click()
  expect((await new AxeBuilder({ page }).include('.canvas-stage').analyze()).violations).toEqual([])
  await page.getByRole('button', { name: 'ภาษา' }).click()
  expect((await new AxeBuilder({ page }).include('.canvas-stage').analyze()).violations).toEqual([])

  await page.locator('.view-switch button').nth(1).click()
  await expect(page.locator('.elevation-stage [data-check-entity-id="bathroom-door"]')).toHaveAttribute('data-check-mark', 'attention')
  await page.locator('.view-switch button').nth(2).click()
  const scene = page.locator('.scene-panel')
  await expect(scene).toHaveAttribute('data-check-attention-count', /[1-9]\d*/)
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
  await policy.getByRole('combobox', { name: 'เกณฑ์หลัก', exact: true }).selectOption('th-public-building')
  await policy.getByLabel('ผู้เลือกเกณฑ์').fill('ที่ปรึกษาทดสอบ')
  await policy.getByRole('button', { name: 'บันทึกเกณฑ์หลัก' }).click()
  await expect(check(page, 'D01')).toHaveAttribute('data-check-status', 'clear')
  await page.getByRole('tab', { name: 'ข้อเสนอแนะ' }).click()
  await expect(page.locator('.review-panel')).toContainText('การทบทวนเป็นข้อมูลเก่า')
  await page.getByRole('button', { name: 'ส่งออก' }).click()
  await page.getByRole('menuitem', { name: 'ดูตัวอย่างรายงานสำหรับพิมพ์' }).click()
  const report = page.getByRole('dialog', { name: 'รายงานการปรับบ้าน' })
  await expect(report.locator('.report-benchmarks')).toContainText('เกณฑ์อาคารสาธารณะ')
  await expect(report.locator('.report-benchmarks')).toContainText('ที่ปรึกษาทดสอบ')
  await expect(report.locator('.report-plan .check-mark-legend')).toHaveCount(2)
  await expect(report.locator('.report-plan .check-mark-legend').first()).toContainText('เส้นทึบ + !: ต้องให้ความสำคัญ')
  await expect(report.locator('.report-plan .check-mark-legend').first()).toContainText('เส้นประ + ?: ยังไม่ได้ประเมิน')
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
  await expect(page.locator('.inspector-sidebar .recommendation-card')).toContainText('ยังไม่ทราบต้นทุน')

  const comparison = page.locator('.editor-toolbar .check-before-after')
  const currentAttention = Number(await comparison.getAttribute('data-current-attention-count'))
  const proposedAttention = Number(await comparison.getAttribute('data-proposed-attention-count'))
  expect(proposedAttention).toBeLessThan(currentAttention)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.getByRole('button', { name: 'ส่งออก' }).click()
  await page.getByRole('menuitem', { name: 'ดูตัวอย่างรายงานสำหรับพิมพ์' }).click()
  const report = page.getByRole('dialog', { name: 'รายงานการปรับบ้าน' })
  await expect(report.locator('.report-check-comparison [data-rule-id="B01"]')).toHaveAttribute('data-check-before', 'attention')
  await expect(report.locator('.report-check-comparison [data-rule-id="B01"]')).toHaveAttribute('data-check-after', 'clear')
  await report.locator('.report-actions button').nth(1).click()

  await page.getByRole('button', { name: 'เลิกทำ' }).click()
  await expect(page.getByRole('button', { name: 'หลังปรับปรุง' })).toHaveCount(0)
  await expect(page.locator('.inspector-sidebar .recommendation-card')).toHaveCount(0)
})

test('keyboard-only fix flow opens, applies and returns focus to its trigger', async ({ page }) => {
  await openBathroomExample(page)
  const checksTab = page.locator('.inspector-sidebar [role="tab"]').nth(2)
  await checksTab.focus()
  await page.keyboard.press('Enter')
  const trigger = check(page, 'B01').locator('[data-fix-id="door-rehang-out"]')
  let reached = false
  for (let index = 0; index < 120; index++) {
    if (await trigger.evaluate((element) => element === document.activeElement)) { reached = true; break }
    await page.keyboard.press('Tab')
  }
  expect(reached).toBe(true)
  await page.keyboard.press('Enter')
  const preview = page.getByTestId('fix-preview')
  await expect(preview).toBeVisible()
  const apply = preview.getByRole('button', { name: 'ใช้แนวทางนี้' })
  let applyReached = false
  for (let index = 0; index < 80; index++) {
    if (await apply.evaluate((element) => element === document.activeElement)) { applyReached = true; break }
    await page.keyboard.press('Tab')
  }
  expect(applyReached).toBe(true)
  await page.keyboard.press('Enter')
  await expect(preview).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('on-site verified input remains a likely verdict while benchmark data is pending', async ({ page }) => {
  await openBathroomExample(page)
  await page.getByRole('button', { name: 'ผู้ให้คำปรึกษา' }).click()
  const opening = page.locator('.room-editor .opening-row').first()
  await opening.getByRole('button').click()
  const width = page.locator('.room-editor .opening-open').first().locator('.measure-field').nth(1)
  await width.locator('select').selectOption('advisor-verified')
  await width.getByLabel('ผู้ตรวจสอบค่า').fill('Advisor')
  await width.getByLabel('วิธีตรวจสอบ').selectOption('on-site')
  await width.getByRole('button', { name: 'บันทึกการตรวจสอบ' }).click()
  await page.getByRole('tab').nth(2).click()
  await expect(check(page, 'D01').locator('[data-testid="verdict"][data-outcome="likely-does-not-meet"]').first()).toBeVisible()
  await expect(check(page, 'D01')).not.toContainText('ผ่านอย่างแน่นอน')
})

test('bathroom project with fixture, wet zone and fall survives save, reload and file import/export', async ({ page }) => {
  await openBathroomExample(page)
  await page.getByRole('button', { name: 'มุมมองผนัง', exact: true }).click()
  await page.getByRole('button', { name: 'ผนังด้านตะวันออก', exact: true }).click()
  await page.getByRole('tab').nth(1).click()
  await page.getByRole('button', { name: 'เพิ่มบนผนังนี้' }).click()
  await expect(page.locator('.elevation-fixture')).toHaveCount(1)

  await page.getByRole('tab').nth(4).click()
  const resident = page.locator('.resident-panel')
  await resident.getByRole('button', { name: 'เพิ่มการหกล้ม' }).click()
  const fall = resident.locator('.fall-card').first()
  await fall.getByLabel('พิกัด X (ซม.)', { exact: true }).fill('150')
  await fall.getByLabel('พิกัด Y (ซม.)', { exact: true }).fill('140')
  await fall.getByLabel('พิกัด Y (ซม.)', { exact: true }).press('Enter')
  await expect(page.locator('.project-menu-wrap .save-state')).toHaveText('บันทึกบนอุปกรณ์นี้แล้ว', { timeout: 7000 })

  await page.locator('.project-menu-wrap button').first().click()
  await page.getByRole('menuitem').first().click()
  await expect.poll(() => page.evaluate(() => {
    const value = localStorage.getItem('baan-yoo-dee.project.v2')
    if (!value) return null
    const project = JSON.parse(value).project
    const room = project.current.floors[0].rooms[0]
    return { fixtures: room.fixtures.length, wetZones: room.wetZones.length, hasFall: project.resident.falls[0]?.point !== null }
  })).toEqual({ fixtures: 1, wetZones: 1, hasFall: true })
  await page.reload()
  await page.locator('.welcome-copy > button').click()
  await expect(page.locator('.plan-fixture')).toHaveCount(1)
  await expect(page.locator('.wet-zone')).toHaveCount(1)
  await expect(page.locator('.fall-marker')).toHaveCount(1)

  page.once('dialog', (dialog) => { void dialog.accept() })
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'ไฟล์โครงการ' }).click()
  await page.getByRole('menuitem', { name: 'ดาวน์โหลดไฟล์โครงการ' }).click()
  const download = await downloadPromise
  const bytes = await readFile((await download.path())!, 'utf8')
  const exported = JSON.parse(bytes) as { schemaVersion: number; resident: { falls: { point: unknown }[] }; current: { floors: { rooms: { fixtures: unknown[]; wetZones: unknown[] }[] }[] } }
  const room = exported.current.floors[0].rooms[0]
  expect(exported.schemaVersion).toBe(2)
  expect(room.fixtures).toHaveLength(1)
  expect(room.wetZones).toHaveLength(1)
  expect(exported.resident.falls[0].point).not.toBeNull()

  page.once('dialog', (dialog) => { void dialog.accept() })
  await page.getByRole('button', { name: 'ไฟล์โครงการ' }).click()
  await page.getByRole('menuitem', { name: 'เปิดไฟล์โครงการ' }).click()
  await page.locator('input[type="file"]').setInputFiles({ name: 'bathroom-roundtrip.udhome.json', mimeType: 'application/json', buffer: Buffer.from(bytes) })
  await expect(page.locator('.plan-fixture')).toHaveCount(1)
  await expect(page.locator('.wet-zone')).toHaveCount(1)
  await expect(page.locator('.fall-marker')).toHaveCount(1)
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
  await expect(bar).toHaveAttribute('data-entity-check-status', 'attention')
  await expect(page.getByTestId('move-check-chip')).toContainText('ผลตรวจที่ต้องใส่ใจ')
  await expect(page.getByTestId('move-check-live')).toContainText('ผลตรวจที่ต้องใส่ใจ')
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

test('downloads a wall elevation SVG only in the wall view', async ({ page }) => {
  await openBathroomExample(page)
  await page.getByRole('button', { name: 'ส่งออก' }).click()
  const unavailable = page.getByRole('menuitem', { name: /ดาวน์โหลดผนังที่เลือกเป็น SVG/ })
  await expect(unavailable).toBeDisabled()
  await expect(unavailable).toContainText('ใช้ได้เฉพาะในมุมมองผนัง')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'มุมมองผนัง', exact: true }).click()
  await page.getByRole('button', { name: 'ผนังด้านตะวันออก', exact: true }).click()
  await page.getByRole('button', { name: 'ส่งออก' }).click()
  const available = page.getByRole('menuitem', { name: 'ดาวน์โหลดผนังที่เลือกเป็น SVG' })
  await expect(available).toBeEnabled()
  const downloadPromise = page.waitForEvent('download')
  await available.click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('-east-elevation.svg')
  const svg = await readFile((await download.path())!, 'utf8')
  expect(svg).toContain('<title id="elevation-title">มุมมองผนัง: ผนังด้านตะวันออก</title>')
})

test('draws the bathroom as a technical plan and captures the current drawing', async ({ page }) => {
  await openBathroomExample(page)
  const plan = page.locator('.canvas-stage svg')
  await expect(plan).toHaveAttribute('viewBox', '-360 -360 2720 2520')
  await expect(plan.locator('.plan-wall')).toHaveCount(5)
  await expect(plan.locator('.plan-wall').first()).toHaveCSS('fill', 'rgb(82, 91, 89)')
  await expect(plan.locator('.plan-dimension text').first()).toHaveCSS('fill', 'rgb(23, 93, 145)')
  const wetZone = plan.locator('.wet-zone rect').first()
  await expect(wetZone).toHaveCSS('stroke', 'rgb(53, 95, 117)')
  expect(await wetZone.evaluate((element) => getComputedStyle(element).fill)).toContain('plan-wet-zone-hatch')
  await expect(plan.locator('[data-opening-id="bathroom-door"] .door-leaf')).toHaveCount(1)
  await expect(plan.locator('.plan-item .item-symbol ellipse').first()).toBeVisible()
  await expect(plan.locator('[data-dimension-kind="overall"]').filter({ hasText: '2.00 m' })).toHaveCount(1)
  await expect(plan.locator('[data-dimension-kind="overall"]').filter({ hasText: '1.80 m' })).toHaveCount(1)
  await expect(plan.locator('[data-plan-annotation="room-label"]')).toHaveAttribute('aria-label', 'ห้องน้ำ, 3.60 m²')
  await expect(plan.locator('[data-plan-annotation="scale-bar"]')).toHaveAttribute('data-length-mm', '1000')
  await expect(plan.locator('[data-plan-annotation="scale-bar"]')).toContainText('1 ม.')
  await expect(plan.locator('[data-plan-annotation="north-arrow"]')).toHaveAttribute('aria-label', 'ทิศเหนือของแผนผัง')
  expect((await new AxeBuilder({ page }).include('.canvas-stage').analyze()).violations).toEqual([])
  await page.getByRole('button', { name: 'ภาษา' }).click()
  expect((await new AxeBuilder({ page }).include('.canvas-stage').analyze()).violations).toEqual([])
  await page.getByRole('button', { name: 'Language' }).click()
  await page.locator('[data-item-id="toilet-1"]').click()
  const clearances = plan.locator('[data-dimension-kind="clearance"]')
  await expect(clearances).toHaveCount(4)
  await expect(plan.locator('[data-dimension-id="clearance-east"]')).toContainText('0.30 m')
  await expect(plan.locator('[data-dimension-id="clearance-south"]')).toContainText('0.08 m')
  await page.screenshot({ path: path.resolve('docs/handoff/evidence/r1-bathroom-2d.png'), fullPage: true })
})

test('synchronizes numbered schedule rows with plan selection and reports fixture height', async ({ page }) => {
  await openBathroomExample(page)
  const plan = page.locator('.canvas-stage svg')
  const schedule = page.locator('.canvas-wrap .plan-schedule')
  const toiletRow = schedule.locator('[data-schedule-item-id="toilet-1"]')

  await expect(schedule.getByRole('heading', { name: 'ตารางรายการสิ่งของ' })).toBeVisible()
  await expect(plan.locator('[data-item-id="toilet-1"]')).toHaveAttribute('data-item-number', '1')
  await toiletRow.click()
  await expect(plan.locator('[data-item-id="toilet-1"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(toiletRow).toHaveClass(/selected/)

  await plan.locator('[data-item-id="toilet-1"]').click()
  await expect(toiletRow.locator('button')).toHaveAttribute('aria-pressed', 'true')

  expect((await new AxeBuilder({ page }).include('.plan-schedule').analyze()).violations).toEqual([])
  await page.getByRole('button', { name: 'ภาษา' }).click()
  expect((await new AxeBuilder({ page }).include('.plan-schedule').analyze()).violations).toEqual([])
  await page.getByRole('button', { name: 'Language' }).click()

  await page.getByRole('tab', { name: 'อุปกรณ์ติดผนัง' }).click()
  await page.getByRole('button', { name: 'เพิ่มอุปกรณ์' }).click()
  const fixture = page.locator('.canvas-wrap [data-schedule-fixture-id]').first()
  await expect(fixture).toContainText('ระดับสูงจากพื้น')
  await expect(fixture).toContainText('0.')
  await fixture.locator('button').click()
  await expect(plan.locator('.plan-fixture.selected')).toHaveCount(1)

  await page.getByRole('button', { name: 'ส่งออก' }).click()
  await page.getByRole('menuitem', { name: 'ดูตัวอย่างรายงานสำหรับพิมพ์' }).click()
  const report = page.getByRole('dialog', { name: 'รายงานการปรับบ้าน' })
  const reportSchedules = report.locator('.report-plan .plan-schedule')
  await expect(reportSchedules).toHaveCount(1)
  await expect(reportSchedules.first().locator('[data-schedule-item-id="toilet-1"]')).toBeVisible()
  await expect(reportSchedules.first().locator('[data-schedule-fixture-id]')).toContainText('ระดับสูงจากพื้น')
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
  const fall = resident.locator('.fall-card').first()
  await fall.getByLabel('พิกัด X (ซม.)', { exact: true }).fill('150')
  await fall.getByLabel('พิกัด Y (ซม.)', { exact: true }).fill('140')
  await fall.getByLabel('พิกัด Y (ซม.)', { exact: true }).press('Enter')
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
  await expect(report.locator('.report-resident')).toContainText('75')
  await expect(report).toContainText('รายงานนี้ไม่ได้แสดงประวัติการหกล้ม')
  await expect(report).not.toContainText('ลื่นตอนกลางคืน')
  await report.getByLabel('แสดงประวัติการหกล้มในรายงานนี้').check()
  await expect(report).toContainText('ลื่นตอนกลางคืน')
  const reportAxe = await new AxeBuilder({ page }).include('.report-document').analyze()
  expect(reportAxe.violations).toEqual([])
  await page.getByRole('button', { name: 'พิมพ์ / บันทึกเป็น PDF' }).click()
  await page.emulateMedia({ media: 'print' })
})

test('a weak-grip need prioritizes and tags the handle check, then focuses its missing field', async ({ page }) => {
  await openBathroomExample(page)
  const door = page.locator('.room-editor .opening-list li').filter({ hasText: 'ประตู' }).first()
  await door.getByRole('button').click()
  await door.locator('[data-need-focus="door-handle"]').selectOption('')
  await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  const handleCheck = check(page, 'D02')
  const indexOf = (locator: ReturnType<typeof check>) => locator.evaluate((element) => Array.from(element.parentElement!.children).indexOf(element))
  const beforeIndex = await indexOf(handleCheck)

  await page.getByRole('tab', { name: 'ผู้อยู่อาศัย' }).click()
  const resident = page.locator('.inspector-sidebar .resident-panel')
  await resident.getByRole('checkbox', { name: 'หยิบจับไม่ถนัด' }).check()
  const residentAxe = await new AxeBuilder({ page }).include('.resident-panel').analyze()
  expect(residentAxe.violations).toEqual([])

  await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  await expect(handleCheck).toHaveAttribute('data-relevant-needs', 'weak-grip')
  await expect(handleCheck).toContainText('หยิบจับไม่ถนัด')
  expect(await indexOf(handleCheck)).toBeLessThan(beforeIndex)
  await expect(page.getByRole('heading', { name: 'ข้อมูลที่ต้องเพิ่มเพื่อตรวจรายการนี้' })).toBeVisible()
  const checksAxe = await new AxeBuilder({ page }).include('.checks-panel').analyze()
  expect(checksAxe.violations).toEqual([])
  await page.getByRole('button', { name: 'บันทึกชนิดมือจับประตู' }).click()
  await expect.poll(() => page.locator('.room-editor [data-need-focus="door-handle"]').evaluate((element) => element === document.activeElement)).toBe(true)

  await page.getByRole('button', { name: 'ภาษา' }).click()
  await page.getByRole('tab', { name: 'Resident' }).click()
  const residentEnglish = page.locator('.inspector-sidebar .resident-panel')
  await expect(residentEnglish.getByRole('checkbox', { name: 'Difficulty gripping' })).toBeChecked()
  const englishAxe = await new AxeBuilder({ page }).include('.resident-panel').analyze()
  expect(englishAxe.violations).toEqual([])
  await page.getByRole('tab', { name: 'Areas to improve' }).click()
  const englishChecksAxe = await new AxeBuilder({ page }).include('.checks-panel').analyze()
  expect(englishChecksAxe.violations).toEqual([])
})

test('a need alone triggers the health-information warning on project export', async ({ page }) => {
  await openBathroomExample(page)
  await page.getByRole('tab', { name: 'ผู้อยู่อาศัย' }).click()
  await page.locator('.inspector-sidebar .resident-panel').getByRole('checkbox', { name: 'หยิบจับไม่ถนัด' }).check()
  let warning = ''
  page.once('dialog', (dialog) => { warning = dialog.message(); void dialog.dismiss() })
  await page.getByRole('button', { name: 'ไฟล์โครงการ' }).click()
  await page.getByRole('menuitem', { name: 'ดาวน์โหลดไฟล์โครงการ' }).click()
  await expect.poll(() => warning).toContain('ข้อมูลสุขภาพ')
  await page.getByRole('button', { name: 'ส่งออก' }).click()
  await page.getByRole('menuitem', { name: 'ดูตัวอย่างรายงานสำหรับพิมพ์' }).click()
  await expect(page.locator('.report-resident')).toContainText('หยิบจับไม่ถนัด')
})

test('walk-through answers become separate findings, create a recommendation draft, and appear in the report', async ({ page }) => {
  await openBathroomExample(page)
  await page.getByRole('tab', { name: 'เดินสำรวจบ้าน' }).click()
  const panel = page.locator('.inspector-sidebar .walkthrough-panel')
  const question = panel.locator('.walkthrough-question')
  await expect(question).toHaveAttribute('data-question-id', 'floor-rugs')
  await expect(panel).toContainText('ขอบพรม')
  const axe = await new AxeBuilder({ page }).include('.walkthrough-panel').analyze()
  expect(axe.violations).toEqual([])
  await page.getByRole('button', { name: 'ภาษา' }).click()
  await expect(page.getByRole('heading', { name: 'Walk-through' })).toBeVisible()
  const englishAxe = await new AxeBuilder({ page }).include('.walkthrough-panel').analyze()
  expect(englishAxe.violations).toEqual([])
  await page.getByRole('button', { name: 'Language' }).click()

  await panel.getByRole('button', { name: 'ใช่' }).click()
  await expect(panel.locator('[data-finding-kind="hazard"]')).toContainText('เก็บพรม')
  await page.getByRole('tab').nth(2).click()
  await expect(page.locator('.checks-panel .walkthrough-count-line')).toContainText('พบสิ่งเสี่ยง 1 รายการ')
  await page.getByRole('tab', { name: 'เดินสำรวจบ้าน' }).click()
  await panel.getByRole('button', { name: 'เพิ่มในข้อเสนอแนะ' }).click()
  const recommendations = page.locator('.inspector-sidebar .recommendations-panel')
  await expect(recommendations).toBeVisible()
  await expect(recommendations).toContainText('เก็บพรม')

  await page.getByRole('button', { name: 'ยกเลิก' }).click()
  await page.getByRole('button', { name: 'ส่งออก' }).click()
  await page.getByRole('menuitem', { name: 'ดูตัวอย่างรายงานสำหรับพิมพ์' }).click()
  const reportWalkthrough = page.locator('.report-walkthrough')
  await expect(reportWalkthrough).toContainText('2026.11-draft')
  await expect(reportWalkthrough).toContainText('รอการทบทวน')
  await expect(reportWalkthrough).toContainText('พบสิ่งเสี่ยง 1 รายการ')
  await expect(reportWalkthrough).toContainText('พรม')
})

test('walk-through stays usable at phone width with large answer controls and unanswered state', async ({ page }) => {
  await openBathroomExample(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'เดินสำรวจบ้าน' }).click()
  const panel = page.locator('.mobile-sheet .walkthrough-panel')
  const answer = panel.getByRole('button', { name: 'ไม่แน่ใจ' })
  await expect(panel.locator('.walkthrough-question')).toHaveAttribute('data-question-id', 'floor-rugs')
  await expect(panel).toContainText('ยังไม่ได้ตอบ')
  const box = await answer.boundingBox()
  expect(box?.height).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  const axe = await new AxeBuilder({ page }).include('.walkthrough-panel').analyze()
  expect(axe.violations).toEqual([])
  await answer.focus()
  await answer.press('Enter')
  await expect(answer).toHaveAttribute('aria-pressed', 'true')
  await expect(panel.locator('[data-finding-kind="get-checked"]')).toBeVisible()
})

test('effort action list groups walk-through findings, previews fixes, and appears in the report in both locales', async ({ page }) => {
  await openBathroomExample(page)
  await page.getByRole('tab', { name: 'เดินสำรวจบ้าน' }).click()
  const walkthrough = page.locator('.inspector-sidebar .walkthrough-panel')
  await walkthrough.getByRole('button', { name: 'ใช่' }).click()
  await page.getByRole('tab').nth(3).click()

  const actionList = page.locator('.inspector-sidebar .action-list')
  const findingRow = actionList.locator('[data-action-id="finding:floor-rugs"]')
  await expect(findingRow).toHaveAttribute('data-action-tier', 'no-cost')
  await expect(findingRow).toContainText('เก็บพรม')
  await expect(findingRow).toContainText('ยังไม่มีราคาตั้งต้น')
  await expect(actionList.locator('.action-tier-building-work')).toContainText('ควรปรึกษาผู้ประกอบวิชาชีพ')
  const thaiAxe = await new AxeBuilder({ page }).include('.action-list').analyze()
  expect(thaiAxe.violations).toEqual([])

  await page.getByRole('button', { name: 'ภาษา' }).click()
  const englishAxe = await new AxeBuilder({ page }).include('.action-list').analyze()
  expect(englishAxe.violations).toEqual([])
  await page.getByRole('button', { name: 'Language' }).click()

  await actionList.locator('[data-action-kind="fix"] button').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'ยกเลิก' }).click()
  await page.getByRole('button', { name: 'ส่งออก' }).click()
  await page.getByRole('menuitem', { name: 'ดูตัวอย่างรายงานสำหรับพิมพ์' }).click()
  const reportActions = page.locator('.report-action-list')
  await expect(reportActions.locator('[data-action-id="finding:floor-rugs"]')).toHaveAttribute('data-action-tier', 'no-cost')
  await expect(reportActions).toContainText('ทำได้วันนี้ ไม่มีค่าใช้จ่าย')
  await expect(reportActions.locator('.report-action-tier-building-work')).toContainText('ควรปรึกษาผู้ประกอบวิชาชีพ')
})

test('sets a fall location by typing coordinates without using the plan', async ({ page }) => {
  await openBathroomExample(page)
  await page.getByRole('tab', { name: 'ผู้อยู่อาศัย' }).click()
  const resident = page.locator('.inspector-sidebar .resident-panel')
  await resident.getByRole('button', { name: 'เพิ่มการหกล้ม' }).click()
  const fall = resident.locator('.fall-card')
  const x = fall.getByLabel('พิกัด X (ซม.)', { exact: true })
  const y = fall.getByLabel('พิกัด Y (ซม.)', { exact: true })
  await x.fill('150')
  await y.fill('120')
  await y.press('Enter')
  await expect(fall).toContainText('ตำแหน่ง: 150, 120 ซม.')
  await expect(page.locator('.fall-marker')).toHaveCount(1)

  await x.fill('201')
  await y.fill('100')
  await y.press('Enter')
  await expect(fall.getByRole('alert')).toContainText('พิกัดต้องอยู่ภายในห้องปัจจุบัน')
  await expect(fall).toContainText('ตำแหน่ง: 150, 120 ซม.')
})

test('shows the dataset version, disclaimer and both benchmark names in the English report', async ({ page }) => {
  await openBathroomExample(page)
  await page.getByRole('button', { name: 'ภาษา' }).click()
  await page.getByRole('button', { name: 'Exports' }).click()
  await page.getByRole('menuitem', { name: 'Preview printable report' }).click()
  const report = page.getByRole('dialog', { name: 'Home adaptation report' })
  await expect(report).toContainText('2026.10-draft')
  await expect(report).toContainText('These results compare entered measurements with reference benchmarks. They are not a certification. The Ministerial Regulation applies to public buildings, not private homes. Consult a licensed architect or engineer for structural work or work that needs a permit.')
  await expect(report).toContainText('Public-building benchmark (Ministerial Regulation B.E. 2548, amended 2564)')
  await expect(report).toContainText('Home recommendation (Department of Older Persons)')
  const reportCounts = report.locator('.report-check-comparison .checks-counts')
  await expect(report.locator('.report-check-comparison')).toBeVisible()
  await expect(report.locator('.report-plan').first().locator('.report-check-list > li')).toHaveCount(Number(await reportCounts.getAttribute('data-total')))
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
