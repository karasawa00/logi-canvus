import { test, expect } from '@playwright/test'

test.describe('ログイン画面 /login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('Email空のまま送信 — 「メールアドレスを入力してください。」エラーが表示される', async ({
    page,
  }) => {
    await page.getByTestId('submit-button').click()

    const errorMessage = page.getByTestId('error-message')
    await expect(errorMessage).toBeVisible()
    await expect(errorMessage).toHaveText('メールアドレスを入力してください。')
  })

  test('Email入力・パスワード空のまま送信 — 「パスワードを入力してください。」エラーが表示される', async ({
    page,
  }) => {
    await page.getByTestId('email-input').fill('test@example.com')
    await page.getByTestId('submit-button').click()

    const errorMessage = page.getByTestId('error-message')
    await expect(errorMessage).toBeVisible()
    await expect(errorMessage).toHaveText('パスワードを入力してください。')
  })

  test('存在しないアカウントでログイン — 「メールアドレスまたはパスワードが正しくありません。」エラーが表示される', async ({
    page,
  }) => {
    await page.getByTestId('email-input').fill('nonexistent-user-e2e@example.com')
    await page.getByTestId('password-input').fill('wrongpassword123')
    await page.getByTestId('submit-button').click()

    const errorMessage = page.getByTestId('error-message')
    await expect(errorMessage).toBeVisible()
    await expect(errorMessage).toHaveText('メールアドレスまたはパスワードが正しくありません。')
  })

  test('「アカウント作成」リンクをクリック — /signup へ遷移する', async ({ page }) => {
    await page.getByRole('link', { name: 'アカウント作成' }).click()

    await expect(page).toHaveURL('/signup')
  })
})
