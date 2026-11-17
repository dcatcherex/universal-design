# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor.spec.ts >> opens the fictional room example in Thai
- Location: tests\e2e\editor.spec.ts:36:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /ตัวอย่างห้องนั่งเล่น/ })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: /ตัวอย่างห้องนั่งเล่น/ }) with timeout 5000ms
  - waiting for getByRole('heading', { name: /ตัวอย่างห้องนั่งเล่น/ })

```

```yaml
- main:
  - text: บ
  - strong: บ้านอยู่ดี
  - text: วางแผนปรับบ้านให้อยู่สบายขึ้น
  - button "EN"
  - paragraph: บ้านอยู่ดี
  - heading "วางแผนห้องที่เหมาะกับชีวิตประจำวันยิ่งขึ้น" [level=1]
  - paragraph: บันทึกข้อมูลห้องนั่งเล่น ลองปรับตำแหน่ง และแบ่งปันข้อเสนอกับผู้ให้คำปรึกษา
  - button "สร้างโครงการใหม่"
  - button "เปิดตัวอย่างโครงการ"
  - button "เปิดตัวอย่างห้องน้ำ"
  - button "เปิดไฟล์โครงการ"
  - text: ● ข้อมูลอยู่ในอุปกรณ์ของคุณ หนึ่งห้องต่อหนึ่งโครงการ
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test'
  2   | import path from 'node:path'
  3   | import { readFile } from 'node:fs/promises'
  4   | import { Plane, Raycaster, Vector2, Vector3 } from 'three'
  5   | import { createExampleProject } from '../../lib/planner/fixtures'
  6   | import { getPrimaryRoom } from '../../lib/planner/layout-access'
  7   | import { createRoomCamera } from '../../lib/planner/scene/camera'
  8   | 
  9   | type CanvasBounds = { x: number; y: number; width: number; height: number }
  10  | 
  11  | function projectedCanvasPoint(bounds: CanvasBounds, camera: ReturnType<typeof createRoomCamera>, world: Vector3) {
  12  |   camera.updateMatrixWorld(true)
  13  |   const point = world.clone().project(camera)
  14  |   return { x: bounds.x + (point.x + 1) * bounds.width / 2, y: bounds.y + (1 - point.y) * bounds.height / 2 }
  15  | }
  16  | 
  17  | function floorPointAt(bounds: CanvasBounds, camera: ReturnType<typeof createRoomCamera>, point: { x: number; y: number }) {
  18  |   const raycaster = new Raycaster()
  19  |   raycaster.setFromCamera(new Vector2((point.x - bounds.x) * 2 / bounds.width - 1, 1 - (point.y - bounds.y) * 2 / bounds.height), camera)
  20  |   const floor = raycaster.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), 0), new Vector3())
  21  |   if (!floor) throw new Error('Pointer ray did not intersect the floor')
  22  |   return floor
  23  | }
  24  | 
  25  | function furnitureDragPoints(bounds: CanvasBounds, centerMm: { xMm: number; yMm: number }, heightMm: number, targetMm: { xMm: number; yMm: number }) {
  26  |   const room = getPrimaryRoom(createExampleProject('scene-drag-test').proposed!)
  27  |   const camera = createRoomCamera(room, bounds.width / bounds.height)
  28  |   const start = projectedCanvasPoint(bounds, camera, new Vector3(centerMm.xMm / 1000, heightMm / 1000, centerMm.yMm / 1000))
  29  |   const startFloor = floorPointAt(bounds, camera, start)
  30  |   const offsetX = centerMm.xMm / 1000 - startFloor.x
  31  |   const offsetZ = centerMm.yMm / 1000 - startFloor.z
  32  |   const target = projectedCanvasPoint(bounds, camera, new Vector3(targetMm.xMm / 1000 - offsetX, 0, targetMm.yMm / 1000 - offsetZ))
  33  |   return { start, target }
  34  | }
  35  | 
  36  | test('opens the fictional room example in Thai', async ({ page }) => {
  37  |   await page.goto('/')
  38  |   await page.getByRole('button', { name: 'เปิดตัวอย่างโครงการ' }).click()
> 39  |   await expect(page.getByRole('heading', { name: /ตัวอย่างห้องนั่งเล่น/ })).toBeVisible()
      |                                                                             ^ Error: expect(locator).toBeVisible() failed
  40  |   await expect(page.locator('.item-list').getByRole('button', { name: /โซฟา/ })).toBeVisible()
  41  |   await expect(page.locator('.item-list').getByRole('button', { name: /โต๊ะกลาง/ })).toBeVisible()
  42  | })
  43  | 
  44  | test('edits the proposed layout independently and supports undo', async ({ page }) => {
  45  |   await page.goto('/')
  46  |   await page.getByRole('button', { name: 'เปิดตัวอย่างโครงการ' }).click()
  47  |   await page.getByRole('button', { name: 'หลังปรับปรุง' }).click()
  48  |   await page.locator('.item-list').getByRole('button', { name: /โต๊ะกลาง/ }).click()
  49  |   await page.getByLabel('ตำแหน่ง X (ซม.)').fill('350')
  50  |   await page.getByLabel('ตำแหน่ง Y (ซม.)').fill('180')
  51  |   await expect(page.locator('[data-item-id="coffee-table-1"]')).toHaveAttribute('data-x-mm', '3500')
  52  |   await page.getByRole('button', { name: 'หมุน 90°' }).click()
  53  |   await page.getByRole('button', { name: 'เลิกทำ' }).click()
  54  |   await expect(page.locator('[data-item-id="coffee-table-1"]')).toHaveAttribute('data-x-mm', '3500')
  55  |   await expect(page.locator('[data-item-id="coffee-table-1"]')).toHaveAttribute('data-rotation', '0')
  56  |   await page.getByRole('button', { name: 'ก่อนปรับปรุง' }).click()
  57  |   await expect(page.locator('[data-item-id="coffee-table-1"]')).toHaveAttribute('data-x-mm', '3000')
  58  | })
  59  | 
  60  | test('rejects a room resize that invalidates a wall opening', async ({ page }) => {
  61  |   await page.goto('/')
  62  |   await page.getByRole('button', { name: 'เปิดตัวอย่างโครงการ' }).click()
  63  |   await page.getByRole('button', { name: 'แก้ไขห้องปัจจุบัน' }).click()
  64  |   await page.getByLabel('กว้าง (ซม.)').fill('200')
  65  |   await expect(page.getByText(/ขนาดห้องนี้ไม่พอดีกับช่องเปิด/)).toBeVisible()
  66  |   await expect(page.getByLabel('กว้าง (ซม.)')).toHaveValue('600')
  67  | })
  68  | 
  69  | test('cancels a pending placement and rejects an out-of-bounds drag', async ({ page }) => {
  70  |   await page.goto('/')
  71  |   await page.getByRole('button', { name: 'เปิดตัวอย่างโครงการ' }).click()
  72  |   await page.getByRole('button', { name: 'แก้ไขห้องปัจจุบัน' }).click()
  73  |   await page.getByRole('button', { name: 'เก้าอี้นวม, 850 × 850 × 900 mm' }).click()
  74  |   await expect(page.getByText(/กด Escape เพื่อยกเลิก/)).toBeVisible()
  75  |   await page.keyboard.press('Escape')
  76  |   await expect(page.getByText(/กด Escape เพื่อยกเลิก/)).toHaveCount(0)
  77  |   await expect(page.locator('.item-list-row')).toHaveCount(2)
  78  | 
  79  |   const svg = page.locator('svg[aria-label^="แผนผังห้อง"]')
  80  |   await svg.scrollIntoViewIfNeeded()
  81  |   const svgBox = await svg.boundingBox()
  82  |   const sofa = await page.locator('[data-item-id="sofa-1"]').boundingBox()
  83  |   if (!svgBox || !sofa) throw new Error('Room plan or sofa is not visible')
  84  |   await page.mouse.move(sofa.x + sofa.width / 2, sofa.y + sofa.height / 2)
  85  |   await page.mouse.down()
  86  |   await page.mouse.move(svgBox.x + svgBox.width * 0.99, svgBox.y + svgBox.height * 0.84, { steps: 6 })
  87  |   await expect.poll(async () => Number(await page.locator('[data-item-id="sofa-1"]').getAttribute('data-x-mm'))).toBeGreaterThan(6000)
  88  |   await page.mouse.up()
  89  |   await expect(page.getByText(/อยู่นอกขอบเขตห้อง/)).toBeVisible()
  90  |   await expect(page.locator('[data-item-id="sofa-1"]')).toHaveAttribute('data-x-mm', '3000')
  91  | })
  92  | 
  93  | test('creates a new room, places furniture, and keeps the proposal separate', async ({ page }) => {
  94  |   await page.goto('/')
  95  |   await page.getByRole('button', { name: 'สร้างโครงการใหม่' }).click()
  96  |   await page.getByLabel('ชื่อโครงการ').fill('ห้องของครอบครัว')
  97  |   await page.getByRole('button', { name: 'เริ่มโครงการ' }).click()
  98  |   await page.getByRole('button', { name: 'โต๊ะกลาง, 1100 × 600 × 450 mm' }).click()
  99  |   const svg = page.locator('svg[aria-label^="แผนผังห้อง"]')
  100 |   await svg.scrollIntoViewIfNeeded()
  101 |   const roomBox = await svg.boundingBox()
  102 |   if (!roomBox) throw new Error('Room plan is not visible')
  103 |   await page.mouse.click(roomBox.x + roomBox.width / 2, roomBox.y + roomBox.height / 2)
  104 |   await expect(page.locator('.item-list .item-list-row')).toHaveCount(1)
  105 |   await page.getByRole('button', { name: 'สร้างแบบเสนอปรับปรุง' }).click()
  106 |   await page.getByRole('button', { name: 'หลังปรับปรุง' }).click()
  107 |   await page.locator('.item-list').getByRole('button', { name: /โต๊ะกลาง/ }).click()
  108 |   await page.getByLabel('ตำแหน่ง X (ซม.)').fill('350')
  109 |   await expect(page.locator('[data-item-id^="item-"]')).toHaveAttribute('data-x-mm', '3500')
  110 |   await page.getByRole('button', { name: 'ก่อนปรับปรุง' }).click()
  111 |   await expect(page.locator('[data-item-id^="item-"]')).toHaveAttribute('data-x-mm', '3000')
  112 | })
  113 | 
  114 | test('click-to-place maps coordinates through the wall-margin viewBox', async ({ page }) => {
  115 |   await page.goto('/')
  116 |   await page.getByRole('button', { name: 'สร้างโครงการใหม่' }).click()
  117 |   await page.getByLabel('ชื่อโครงการ').fill('ห้องทดสอบพิกัด')
  118 |   await page.getByRole('button', { name: 'เริ่มโครงการ' }).click()
  119 |   await page.getByRole('button', { name: 'โต๊ะกลาง, 1100 × 600 × 450 mm' }).click()
  120 |   const svg = page.locator('svg[aria-label^="แผนผังห้อง"]')
  121 |   const target = await svg.evaluate((element) => {
  122 |     const plan = element as SVGSVGElement
  123 |     const roomWidth = plan.viewBox.baseVal.width - 720
  124 |     const roomDepth = plan.viewBox.baseVal.height - 720
  125 |     const point = plan.createSVGPoint()
  126 |     point.x = roomWidth * .55
  127 |     point.y = roomDepth * .45
  128 |     const expectedX = Math.round(point.x / 50) * 50
  129 |     const expectedY = Math.round(point.y / 50) * 50
  130 |     const client = point.matrixTransform(plan.getScreenCTM()!)
  131 |     return { clientX: client.x, clientY: client.y, expectedX, expectedY }
  132 |   })
  133 |   await page.mouse.click(target.clientX, target.clientY)
  134 |   const item = page.locator('[data-item-id^="item-"]')
  135 |   await expect(item).toHaveAttribute('data-x-mm', String(target.expectedX))
  136 |   await expect(item).toHaveAttribute('data-y-mm', String(target.expectedY))
  137 | })
  138 | 
  139 | test('persists the dimensions toggle and hides wall chains at 390px', async ({ page }) => {
```