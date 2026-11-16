# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: r1-flow.spec.ts >> upgrades a v1 project file and a v1 saved project without touching the old data
- Location: tests\e2e\r1-flow.spec.ts:34:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.review-panel')
Expected substring: "การทบทวนไม่เป็นปัจจุบัน"
Received string:    "การทบทวนโดยผู้ให้คำปรึกษาการทบทวนเป็นข้อมูลเก่าฉบับโครงการที่ทบทวน2วันที่ทบทวน28 ก.ย. 2569เป็นบันทึกในอุปกรณ์นี้เท่านั้น ไม่ได้ยืนยันตัวตนหรือคุณวุฒิวิชาชีพชื่อผู้ทบทวน (กรอกเอง)บันทึกการทบทวนสำหรับฉบับนี้"
Timeout: 5000ms

Call log:
  - Expect "toContainText" locator('.review-panel') with timeout 5000ms
  - waiting for locator('.review-panel')
    14 × locator resolved to <section class="review-panel" aria-labelledby="review-panel-title">…</section>
       - unexpected value "การทบทวนโดยผู้ให้คำปรึกษาการทบทวนเป็นข้อมูลเก่าฉบับโครงการที่ทบทวน2วันที่ทบทวน28 ก.ย. 2569เป็นบันทึกในอุปกรณ์นี้เท่านั้น ไม่ได้ยืนยันตัวตนหรือคุณวุฒิวิชาชีพชื่อผู้ทบทวน (กรอกเอง)บันทึกการทบทวนสำหรับฉบับนี้"

```

```yaml
- region "การทบทวนโดยผู้ให้คำปรึกษา":
  - heading "การทบทวนโดยผู้ให้คำปรึกษา" [level=3]
  - status: การทบทวนเป็นข้อมูลเก่า
  - term: ฉบับโครงการที่ทบทวน
  - definition: "2"
  - term: วันที่ทบทวน
  - definition: 28 ก.ย. 2569
  - paragraph: เป็นบันทึกในอุปกรณ์นี้เท่านั้น ไม่ได้ยืนยันตัวตนหรือคุณวุฒิวิชาชีพ
  - text: ชื่อผู้ทบทวน (กรอกเอง)
  - textbox "ชื่อผู้ทบทวน (กรอกเอง)"
  - button "บันทึกการทบทวนสำหรับฉบับนี้"
```

# Test source

```ts
  1   | import AxeBuilder from '@axe-core/playwright'
  2   | import { expect, test, type Page } from '@playwright/test'
  3   | import { readFile } from 'node:fs/promises'
  4   | import path from 'node:path'
  5   | 
  6   | const now = '2026-09-28T00:00:00.000Z'
  7   | const m = (valueMm: number) => ({ valueMm, confidence: 'estimated' })
  8   | 
  9   | /** A project file exactly as v1 wrote it. */
  10  | function v1File() {
  11  |   const layout = {
  12  |     room: { width: m(6000), depth: m(5000), height: m(2700) },
  13  |     openings: [{ id: 'entry-door', kind: 'door', wall: 'north', offset: m(300), width: m(900), height: m(2100), sill: m(0), threshold: m(0), operation: 'hinged-in', hinge: 'start' }],
  14  |     items: [{ id: 'sofa-1', catalogId: 'sofa', label: 'โซฟาเดิม', center: { xMm: 3000, yMm: 4200 }, width: m(2100), depth: m(900), height: m(850), rotationDeg: 0, finish: 'sage', obstruction: 'solid' }],
  15  |     routes: [], turningAreas: [],
  16  |   }
  17  |   return {
  18  |     schemaVersion: 1, id: 'v1-file', title: 'โครงการรุ่นหนึ่ง', createdAt: now, updatedAt: now, revision: 2,
  19  |     household: { province: 'เชียงใหม่', activities: [], mobilityAids: [], concerns: [], assistanceNotes: '', residentPreferences: '', budgetSatang: null },
  20  |     current: layout, proposed: null, targets: { routeWidth: null, turningDiameter: null }, recommendations: [],
  21  |     review: { reviewerName: 'ผู้ทบทวนเดิม', reviewedAt: now, projectRevision: 2 },
  22  |   }
  23  | }
  24  | 
  25  | async function openBathroomExample(page: Page) {
  26  |   await page.setViewportSize({ width: 1440, height: 900 })
  27  |   await page.goto('/')
  28  |   await page.getByRole('button', { name: 'เปิดตัวอย่างห้องน้ำ' }).click()
  29  |   await expect(page.getByRole('heading', { name: /ตัวอย่างห้องน้ำ/ })).toBeVisible()
  30  | }
  31  | 
  32  | const check = (page: Page, ruleId: string) => page.locator(`.inspector-sidebar [data-testid="check-result"][data-rule-id="${ruleId}"]`)
  33  | 
  34  | test('upgrades a v1 project file and a v1 saved project without touching the old data', async ({ page }) => {
  35  |   await page.goto('/')
  36  |   await page.locator('input[type="file"]').setInputFiles({ name: 'old.udhome.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(v1File())) })
  37  |   await expect(page.getByRole('heading', { name: 'โครงการรุ่นหนึ่ง' })).toBeVisible()
  38  |   await expect(page.locator('.item-list').getByRole('button', { name: /โซฟาเดิม/ })).toBeVisible()
  39  |   await expect(page.locator('[data-item-id="sofa-1"]')).toHaveAttribute('data-x-mm', '3000')
  40  |   // The old review covered checks without benchmarks, so it shows as outdated.
  41  |   await page.getByRole('button', { name: 'ผู้ให้คำปรึกษา' }).click()
  42  |   await page.getByRole('tab', { name: 'ข้อเสนอแนะ' }).click()
> 43  |   await expect(page.locator('.review-panel')).toContainText('การทบทวนไม่เป็นปัจจุบัน')
      |                                               ^ Error: expect(locator).toContainText(expected) failed
  44  | 
  45  |   // The same project saved by v1 in the browser opens on the next visit, and its entry is left alone.
  46  |   const legacy = JSON.stringify({ storageVersion: 1, writeToken: 'old-token', project: v1File() })
  47  |   await page.evaluate((value) => { localStorage.clear(); localStorage.setItem('baan-yoo-dee.project.v1', value) }, legacy)
  48  |   await page.reload()
  49  |   await expect(page.getByText(/ถูกปรับรุ่นจากเวอร์ชันก่อนหน้า/)).toBeVisible()
  50  |   await page.getByRole('button', { name: /ทำโครงการต่อ/ }).click()
  51  |   await expect(page.getByRole('status').filter({ hasText: /ถูกปรับรุ่นจากเวอร์ชันก่อนหน้า/ })).toBeVisible()
  52  |   await page.locator('.item-list').getByRole('button', { name: /โซฟาเดิม/ }).click()
  53  |   await page.getByLabel('ตำแหน่ง X (ซม.)').fill('310')
  54  |   await expect(page.locator('.project-menu-wrap .save-state')).toHaveText('บันทึกบนอุปกรณ์นี้แล้ว', { timeout: 7000 })
  55  |   const stored = await page.evaluate(() => ({ v1: localStorage.getItem('baan-yoo-dee.project.v1'), v2: localStorage.getItem('baan-yoo-dee.project.v2') }))
  56  |   expect(stored.v1).toBe(legacy)
  57  |   expect(JSON.parse(stored.v2!).project.schemaVersion).toBe(2)
  58  | })
  59  | 
  60  | test('shows both benchmarks for the bathroom example and never a definite verdict', async ({ page }) => {
  61  |   await openBathroomExample(page)
  62  |   await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  63  |   await expect(page.getByTestId('benchmark-banner').first()).toContainText('2026.10-draft')
  64  |   for (const ruleId of ['D01', 'D03', 'B01', 'B02', 'B03']) await expect(check(page, ruleId)).toHaveAttribute('data-check-status', 'attention')
  65  |   await expect(check(page, 'B05')).toHaveAttribute('data-check-status', 'not-evaluated')
  66  |   await expect(check(page, 'B03')).toContainText('ยังไม่มีราวจับ')
  67  | 
  68  |   const doorWidth = check(page, 'D01')
  69  |   await expect(doorWidth.getByTestId('verdict')).toHaveCount(2)
  70  |   await expect(doorWidth.locator('[data-benchmark="th-public-building"]')).toContainText('ข้อ 18(3)')
  71  |   await expect(doorWidth.locator('[data-benchmark="th-public-building"]')).toContainText('น่าจะไม่เป็นไปตามเกณฑ์')
  72  |   await expect(doorWidth.locator('[data-benchmark="th-dop-home"]')).toContainText('คำแนะนำสำหรับบ้าน')
  73  |   await expect(doorWidth).toContainText('ให้ผู้เชี่ยวชาญตรวจสอบ')
  74  |   // "No benchmark value" is shown as such, not as a failure.
  75  |   await expect(check(page, 'B02').locator('[data-key="toilet.seatHeight"][data-benchmark="th-dop-home"]')).toHaveAttribute('data-outcome', 'no-value')
  76  |   await expect(page.locator('.inspector-sidebar [data-outcome="meets"], .inspector-sidebar [data-outcome="does-not-meet"]')).toHaveCount(0)
  77  |   await expect(page.locator('.inspector-sidebar .checks-disclaimer')).toContainText('ไม่ใช่การรับรอง')
  78  | 
  79  |   const axe = await new AxeBuilder({ page }).include('.inspector-sidebar').analyze()
  80  |   expect(axe.violations).toEqual([])
  81  |   await page.screenshot({ path: path.resolve('docs/handoff/evidence/r1-bathroom-2d.png') })
  82  | })
  83  | 
  84  | test('an advisor chooses the primary benchmark, which changes results and outdates the review', async ({ page }) => {
  85  |   await page.setViewportSize({ width: 1440, height: 900 })
  86  |   await page.goto('/')
  87  |   await page.getByRole('button', { name: 'เปิดตัวอย่างโครงการ' }).click()
  88  |   await page.getByRole('button', { name: 'แก้ไขห้องปัจจุบัน' }).click()
  89  |   // Narrow the door to 870 mm: it meets the public-building width (860) but not the home one (900).
  90  |   await page.getByRole('button', { name: /^แก้ไข: ประตู/ }).click()
  91  |   const width = page.getByLabel('ความกว้างสุทธิของช่องเปิด (ซม.)', { exact: true })
  92  |   await width.fill('87')
  93  |   await width.press('Enter')
  94  |   await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  95  |   await expect(check(page, 'D01')).toHaveAttribute('data-check-status', 'attention')
  96  | 
  97  |   await page.getByRole('button', { name: 'ผู้ให้คำปรึกษา' }).click()
  98  |   await page.getByRole('tab', { name: 'ข้อเสนอแนะ' }).click()
  99  |   await page.getByLabel('ชื่อผู้ทบทวน (กรอกเอง)').fill('ผู้ทบทวน')
  100 |   await page.getByRole('button', { name: 'บันทึกการทบทวนสำหรับฉบับนี้' }).click()
  101 |   await expect(page.locator('.review-panel')).toContainText('ทบทวนฉบับปัจจุบันแล้ว')
  102 | 
  103 |   await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  104 |   const policy = page.locator('.inspector-sidebar .benchmark-policy')
  105 |   await policy.getByLabel('เกณฑ์หลัก', { exact: true }).selectOption('th-public-building')
  106 |   await policy.getByLabel('ผู้เลือกเกณฑ์').fill('ที่ปรึกษาทดสอบ')
  107 |   await policy.getByRole('button', { name: 'บันทึกเกณฑ์หลัก' }).click()
  108 |   await expect(check(page, 'D01')).toHaveAttribute('data-check-status', 'clear')
  109 |   await page.getByRole('tab', { name: 'ข้อเสนอแนะ' }).click()
  110 |   await expect(page.locator('.review-panel')).toContainText('การทบทวนไม่เป็นปัจจุบัน')
  111 | })
  112 | 
  113 | test('previews and applies a fix as one undoable step', async ({ page }) => {
  114 |   await openBathroomExample(page)
  115 |   await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  116 |   await check(page, 'B01').locator('[data-fix-id="door-rehang-out"]').click()
  117 |   const preview = page.getByTestId('fix-preview')
  118 |   await expect(preview).toContainText('ระบบจะสร้างห้องหลังปรับปรุงจากห้องปัจจุบัน')
  119 |   await expect(preview.locator('[data-rule-id="B01"]')).toHaveAttribute('data-to', 'clear')
  120 |   await expect(preview).toContainText('ยังไม่มีราคาตั้งต้น')
  121 |   // Nothing is committed while the preview is open.
  122 |   await expect(page.getByRole('button', { name: 'หลังปรับปรุง' })).toHaveCount(0)
  123 |   const axe = await new AxeBuilder({ page }).include('[data-testid="fix-preview"]').analyze()
  124 |   expect(axe.violations).toEqual([])
  125 |   await preview.getByRole('button', { name: 'ใช้แนวทางนี้' }).click()
  126 | 
  127 |   await page.getByRole('button', { name: 'หลังปรับปรุง' }).click()
  128 |   await expect(check(page, 'B01')).toHaveAttribute('data-check-status', 'clear')
  129 |   await page.getByRole('tab', { name: 'ข้อเสนอแนะ' }).click()
  130 |   await expect(page.locator('.inspector-sidebar .recommendation-card')).toHaveCount(1)
  131 |   await expect(page.locator('.inspector-sidebar .recommendation-card')).toContainText('กลับบานประตูให้เปิดออกด้านนอก')
  132 |   await expect(page.locator('.inspector-sidebar .recommendation-card')).toContainText('ยังไม่ทราบค่าใช้จ่าย')
  133 | 
  134 |   await page.getByRole('button', { name: 'เลิกทำ' }).click()
  135 |   await expect(page.getByRole('button', { name: 'หลังปรับปรุง' })).toHaveCount(0)
  136 |   await expect(page.locator('.inspector-sidebar .recommendation-card')).toHaveCount(0)
  137 | })
  138 | 
  139 | test('adds a grab bar in the wall view and moves it by keyboard and by number', async ({ page }) => {
  140 |   await openBathroomExample(page)
  141 |   await page.getByRole('button', { name: 'มุมมองผนัง', exact: true }).click()
  142 |   await page.getByRole('button', { name: 'ผนังด้านตะวันออก', exact: true }).click()
  143 |   await page.getByRole('button', { name: 'เพิ่มบนผนังนี้' }).click()
```