export function webQuality() {
  return {
    "playwright.config.js": `import { defineConfig } from '@playwright/test';\nexport default defineConfig({ testDir: './e2e', use: { baseURL: 'http://127.0.0.1:4173' }, webServer: { command: 'npx vite --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: false } });\n`,
    "e2e/home.spec.js": `import { test, expect } from '@playwright/test';\ntest('page loads and exposes a keyboard-accessible documentation link', async ({ page }) => { const errors = []; page.on('pageerror', error => errors.push(error.message)); await page.goto('/'); await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); const link = page.getByRole('link', { name: 'Explore web documentation' }); await expect(link).toHaveAttribute('href', 'https://developer.mozilla.org/'); await page.keyboard.press('Tab'); await expect(link).toBeFocused(); expect(errors).toEqual([]); });\n`,
  };
}
