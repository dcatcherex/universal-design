# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: r1-flow.spec.ts >> previews and applies a fix as one undoable step
- Location: tests\e2e\r1-flow.spec.ts:113:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.inspector-sidebar .recommendation-card')
Expected substring: "ยังไม่ทราบค่าใช้จ่าย"
Received string:    "เสนอลำดับถัดไปหลังปรับปรุงกลับบานประตูให้เปิดออกด้านนอกย้ายบานพับให้ประตูเปิดออกด้านนอก เพื่อให้เปิดจากด้านนอกได้แม้มีคนล้มอยู่หลังประตูกลับบานประตูให้เปิดออกด้านนอกประมาณการวัสดุ: ยังไม่ทราบต้นทุนประมาณการค่าแรง: ยังไม่ทราบต้นทุนแก้ไขลบ"
Timeout: 5000ms

Call log:
  - Expect "toContainText" locator('.inspector-sidebar .recommendation-card') with timeout 5000ms
  - waiting for locator('.inspector-sidebar .recommendation-card')
    14 × locator resolved to <article class="recommendation-card">…</article>
       - unexpected value "เสนอลำดับถัดไปหลังปรับปรุงกลับบานประตูให้เปิดออกด้านนอกย้ายบานพับให้ประตูเปิดออกด้านนอก เพื่อให้เปิดจากด้านนอกได้แม้มีคนล้มอยู่หลังประตูกลับบานประตูให้เปิดออกด้านนอกประมาณการวัสดุ: ยังไม่ทราบต้นทุนประมาณการค่าแรง: ยังไม่ทราบต้นทุนแก้ไขลบ"

```

```yaml
- article:
  - text: เสนอ ลำดับถัดไป หลังปรับปรุง
  - heading "กลับบานประตูให้เปิดออกด้านนอก" [level=3]
  - paragraph: ย้ายบานพับให้ประตูเปิดออกด้านนอก เพื่อให้เปิดจากด้านนอกได้แม้มีคนล้มอยู่หลังประตู
  - paragraph: กลับบานประตูให้เปิดออกด้านนอก
  - paragraph: "ประมาณการวัสดุ: ยังไม่ทราบต้นทุน"
  - paragraph: "ประมาณการค่าแรง: ยังไม่ทราบต้นทุน"
  - button "แก้ไข"
  - button "ลบ"
```

# Test source

```ts
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
  43  |   await expect(page.locator('.review-panel')).toContainText('การทบทวนไม่เป็นปัจจุบัน')
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
> 132 |   await expect(page.locator('.inspector-sidebar .recommendation-card')).toContainText('ยังไม่ทราบค่าใช้จ่าย')
      |                                                                         ^ Error: expect(locator).toContainText(expected) failed
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
  144 |   const bar = page.locator('.elevation-fixture')
  145 |   await expect(bar).toHaveCount(1)
  146 |   await expect(bar).toHaveAttribute('data-height-mm', '800')
  147 |   // Its benchmark band is drawn while it is selected; only the public-building benchmark has one.
  148 |   await expect(page.getByTestId('benchmark-band')).toHaveCount(1)
  149 |   await expect(page.getByTestId('benchmark-band')).toContainText('65–70')
  150 | 
  151 |   // Keyboard: 10 mm per press, 50 mm with Shift. 800 → 700 → 680.
  152 |   await bar.focus()
  153 |   await bar.press('Shift+ArrowDown')
  154 |   await bar.press('Shift+ArrowDown')
  155 |   await bar.press('ArrowDown')
  156 |   await bar.press('ArrowDown')
  157 |   await expect(bar).toHaveAttribute('data-height-mm', '680')
  158 |   await bar.press('Shift+ArrowRight')
  159 |   await expect(bar).toHaveAttribute('data-offset-mm', '950')
  160 | 
  161 |   // Number: the inspector shows the same values and accepts a new offset.
  162 |   const height = page.getByLabel('ระดับจุดอ้างอิงจากพื้น (ซม.)', { exact: true })
  163 |   await expect(height).toHaveValue('68')
  164 |   const offset = page.getByLabel('ระยะกึ่งกลางจากจุดเริ่มผนัง (ซม.)', { exact: true })
  165 |   await offset.fill('110')
  166 |   await offset.press('Enter')
  167 |   await expect(bar).toHaveAttribute('data-offset-mm', '1100')
  168 |   // A position off the wall is refused with a reason and nothing changes.
  169 |   await offset.fill('175')
  170 |   await offset.press('Enter')
  171 |   await expect(page.getByText('ตำแหน่งนี้อยู่นอกแนวผนังหรือสูงเกินเพดาน')).toBeVisible()
  172 |   await expect(bar).toHaveAttribute('data-offset-mm', '1100')
  173 |   await page.screenshot({ path: path.resolve('docs/handoff/evidence/r1-wall-elevation.png') })
  174 | 
  175 |   // Drag: down by about a third of the wall height.
  176 |   const box = (await bar.locator('.elevation-shape').boundingBox())!
  177 |   await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  178 |   await page.mouse.down()
  179 |   await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40, { steps: 5 })
  180 |   await page.mouse.up()
  181 |   expect(Number(await bar.getAttribute('data-height-mm'))).toBeLessThan(680)
  182 |   await page.getByRole('button', { name: 'เลิกทำ' }).click()
  183 |   await expect(bar).toHaveAttribute('data-height-mm', '680')
  184 | 
  185 |   // The plan shows the same fixture on the same wall, and the grab bar check now finds it.
  186 |   await page.getByRole('button', { name: 'แผนผัง 2 มิติ' }).click()
  187 |   const symbol = page.locator('.plan-fixture')
  188 |   await expect(symbol).toHaveAttribute('data-wall', 'east')
  189 |   await expect(symbol).toHaveAttribute('data-offset-mm', '1100')
  190 |   await expect(symbol).toHaveAttribute('data-height-mm', '680')
  191 |   await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  192 |   await expect(check(page, 'B03')).not.toContainText('ยังไม่มีราวจับ')
  193 | 
  194 |   // 3D draws it too.
  195 |   await page.getByRole('button', { name: 'มุมมอง 3 มิติ' }).click()
  196 |   await expect(page.getByTestId('room-scene-canvas')).toBeVisible()
  197 |   await page.waitForTimeout(600)
  198 |   await page.screenshot({ path: path.resolve('docs/handoff/evidence/r1-bathroom-3d.png') })
  199 | 
  200 |   // Undo all the way back removes the fixture.
  201 |   await page.getByRole('button', { name: 'แผนผัง 2 มิติ' }).click()
  202 |   for (let step = 0; step < 8 && await page.getByRole('button', { name: 'เลิกทำ' }).isEnabled(); step++) await page.getByRole('button', { name: 'เลิกทำ' }).click()
  203 |   await expect(page.locator('.plan-fixture')).toHaveCount(0)
  204 | })
  205 | 
  206 | test('records the resident, marks a fall, and keeps health data out of the report by default', async ({ page }) => {
  207 |   await page.addInitScript(() => { window.print = () => undefined })
  208 |   await openBathroomExample(page)
  209 |   await page.getByRole('tab', { name: 'ผู้อยู่อาศัย' }).click()
  210 |   const resident = page.locator('.inspector-sidebar .resident-panel')
  211 |   await expect(resident).toContainText('ข้อมูลสุขภาพ')
  212 |   const chairWidth = resident.getByLabel('ความกว้างรวมของรถเข็น (ซม.)', { exact: true })
  213 |   await chairWidth.fill('75')
  214 |   await chairWidth.press('Enter')
  215 |   const axe = await new AxeBuilder({ page }).include('.resident-panel').analyze()
  216 |   expect(axe.violations).toEqual([])
  217 | 
  218 |   await resident.getByRole('button', { name: 'เพิ่มการหกล้ม' }).click()
  219 |   await resident.getByLabel('บันทึกเพิ่มเติมเกี่ยวกับการหกล้ม (ไม่บังคับ)').fill('ลื่นตอนกลางคืน')
  220 |   await resident.getByLabel('บันทึกเพิ่มเติมเกี่ยวกับการหกล้ม (ไม่บังคับ)').blur()
  221 |   // With no location, every problem in the room counts as near the fall.
  222 |   await page.getByRole('tab', { name: 'จุดที่ควรปรับปรุง' }).click()
  223 |   await expect(check(page, 'D01')).toHaveAttribute('data-near-fall', 'true')
  224 |   // The 700 mm door is narrower than the 750 mm wheelchair.
  225 |   await expect(check(page, 'H03')).toHaveAttribute('data-check-status', 'attention')
  226 |   await expect(check(page, 'H03')).toContainText('ไม่ได้เผื่อระยะสำหรับมือ')
  227 | 
  228 |   // Mark the fall beside the toilet: now only nearby results are flagged, and they come first.
  229 |   await page.getByRole('tab', { name: 'ผู้อยู่อาศัย' }).click()
  230 |   await resident.getByRole('button', { name: 'ระบุบนแผนผัง' }).click()
  231 |   const plan = page.locator('svg[aria-label^="แผนผังห้อง"]')
  232 |   const box = (await plan.boundingBox())!
```