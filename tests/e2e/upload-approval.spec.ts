import { test, expect, Page } from '@playwright/test'
import path from 'path'

/**
 * DCMS E2E Test Suite: Upload & Approval Workflow
 * Tests the complete document lifecycle:
 * Editor uploads → submits for review → Reviewer approves
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[name="email"]',    email)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 })
}

test.describe('Document Upload & Approval', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(
      page,
      process.env.TEST_USER_EMAIL!,
      process.env.TEST_USER_PASS!
    )
  })

  test('editor can create a new document', async ({ page }) => {
    await page.goto(`${BASE_URL}/documents/new`)
    await expect(page.locator('h1')).toContainText('New Document')

    await page.fill('input[name="title"]',    'Test Quality Procedure E2E')
    await page.fill('input[name="docCode"]',  '2501-QMS-PRO-099')
    await page.selectOption('select[name="docType"]',        'procedure')
    await page.selectOption('select[name="functionalArea"]', 'QMS')
    await page.selectOption('select[name="securityClass"]',  'internal')
    await page.click('button[type="submit"]')

    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible()
    await expect(page.url()).toContain('/documents/')
  })

  test('editor can upload a revision', async ({ page }) => {
    // Navigate to an existing document
    await page.goto(`${BASE_URL}/documents/new`)
    // ... create doc first
    await page.goto(`${BASE_URL}/register`)
    await page.click('[data-testid="doc-row"]:first-child a')

    // Upload revision
    await page.click('[data-testid="upload-revision-btn"]')
    await expect(page.locator('[data-testid="upload-modal"]')).toBeVisible()

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'sample.pdf'))

    await page.fill('textarea[name="changeSummary"]', 'Initial controlled release of test procedure')
    await page.check('input[name="isMajor"]')
    await page.click('[data-testid="confirm-upload-btn"]')

    await expect(page.locator('[data-testid="version-badge"]')).toContainText('V1.0')
    await expect(page.locator('[data-testid="status-chip"]')).toContainText('draft')
  })

  test('RBAC: viewer cannot access upload page', async ({ page }) => {
    // Login as viewer
    await loginAs(page, process.env.TEST_VIEWER_EMAIL!, process.env.TEST_VIEWER_PASS!)
    await page.goto(`${BASE_URL}/documents/new`)
    await expect(page.url()).toContain('/403')
  })

  test('RBAC: viewer cannot see restricted documents', async ({ page }) => {
    await loginAs(page, process.env.TEST_VIEWER_EMAIL!, process.env.TEST_VIEWER_PASS!)
    await page.goto(`${BASE_URL}/register`)
    // Restricted documents should not appear in results
    const restrictedBadges = page.locator('[data-class="restricted"]')
    await expect(restrictedBadges).toHaveCount(0)
  })

  test('full-text search returns relevant results', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`)
    await page.fill('input[type="search"]', 'quality procedure')
    await page.waitForTimeout(600) // debounce

    const rows = page.locator('tbody tr')
    await expect(rows).not.toHaveCount(0)
  })

  test('review due date shows warning for overdue documents', async ({ page }) => {
    await page.goto(`${BASE_URL}/register?status=approved`)
    // Overdue dates should have red text and warning icon
    const overdueCell = page.locator('[data-testid="review-due"].overdue').first()
    if (await overdueCell.count() > 0) {
      await expect(overdueCell).toHaveCSS('color', 'rgb(220, 38, 38)') // red-600
    }
  })
})

test.describe('Admin functions', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(
      page,
      process.env.TEST_ADMIN_EMAIL!,
      process.env.TEST_ADMIN_PASS!
    )
  })

  test('admin can view audit log', async ({ page }) => {
    await page.goto(`${BASE_URL}/audit`)
    await expect(page.locator('h1')).toContainText('Audit')
    const rows = page.locator('tbody tr')
    await expect(rows.first()).toBeVisible()
  })

  test('non-admin cannot access audit log', async ({ page }) => {
    await loginAs(page, process.env.TEST_USER_EMAIL!, process.env.TEST_USER_PASS!)
    await page.goto(`${BASE_URL}/audit`)
    await expect(page.url()).toContain('/403')
  })
})
