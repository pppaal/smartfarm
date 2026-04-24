import { test, expect } from '@playwright/test';

// 브라우저 레벨 기본 플로 검증. 백엔드가 http://localhost:4000, 프론트가 http://localhost:5173 실행 중이어야 함.
// 실행: npx playwright test

test('로그인 화면 노출', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('h1')).toContainText('스마트팜');
  await expect(page.getByPlaceholder('이메일')).toBeVisible();
});

test('약관 없이 회원가입 차단', async ({ page }) => {
  await page.goto('/register');
  await page.getByPlaceholder('이름').fill('E2E');
  await page.getByPlaceholder('이메일').fill(`e2e${Date.now()}@t.kr`);
  await page.getByPlaceholder(/비밀번호/).fill('password1');
  const submit = page.getByRole('button', { name: '가입하기' });
  await expect(submit).toBeDisabled();
});

test('이용약관 페이지 접근', async ({ page }) => {
  await page.goto('/terms');
  await expect(page.locator('h1')).toContainText('이용약관');
  await expect(page.locator('h2').first()).toContainText('제1조');
});

test('개인정보처리방침 페이지 접근', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.locator('h1')).toContainText('개인정보처리방침');
});

test('데모 계정으로 로그인 후 대시보드 진입', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('이메일').fill('demo@smartfarm.kr');
  await page.getByPlaceholder('비밀번호').fill('demo1234');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL(/\/(|dashboard)$/);
  await expect(page.locator('aside h1')).toContainText('스마트팜');
});
