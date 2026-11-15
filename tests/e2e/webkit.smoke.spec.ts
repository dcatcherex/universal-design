import { expect, test } from '@playwright/test'

test('opens the Thai example and retains the accessible 2D plan in WebKit', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'เปิดตัวอย่างโครงการ' }).click()
  await expect(page.getByRole('heading', { name: /ตัวอย่างห้องนั่งเล่น/ })).toBeVisible()
  await expect(page.locator('svg[aria-label^="แผนผังห้อง"]')).toBeVisible()
})
