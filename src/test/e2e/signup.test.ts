import { test, expect } from '@playwright/test'

test.describe('サインアップ画面 /signup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup')
  })

  test('Step1: 名前空のまま「次へ」— エラーが表示される', async ({ page }) => {
    await page.getByTestId('next-button').click()

    await expect(page.getByTestId('error-message')).toHaveText('名前を入力してください。')
  })

  test('Step1: 不正なメールアドレスで「次へ」— エラーが表示される', async ({ page }) => {
    await page.getByTestId('name-input').fill('テスト太郎')
    await page.getByTestId('email-input').fill('invalid-email')
    await page.getByTestId('password-input').fill('password123')
    await page.getByTestId('password-confirm-input').fill('password123')
    await page.getByTestId('next-button').click()

    await expect(page.getByTestId('error-message')).toHaveText(
      '有効なメールアドレスを入力してください。',
    )
  })

  test('Step1: パスワード8文字未満で「次へ」— エラーが表示される', async ({ page }) => {
    await page.getByTestId('name-input').fill('テスト太郎')
    await page.getByTestId('email-input').fill('test@example.com')
    await page.getByTestId('password-input').fill('short')
    await page.getByTestId('password-confirm-input').fill('short')
    await page.getByTestId('next-button').click()

    await expect(page.getByTestId('error-message')).toHaveText(
      'パスワードは8文字以上で入力してください。',
    )
  })

  test('Step1: パスワード不一致で「次へ」— エラーが表示される', async ({ page }) => {
    await page.getByTestId('name-input').fill('テスト太郎')
    await page.getByTestId('email-input').fill('test@example.com')
    await page.getByTestId('password-input').fill('password123')
    await page.getByTestId('password-confirm-input').fill('different123')
    await page.getByTestId('next-button').click()

    await expect(page.getByTestId('error-message')).toHaveText('パスワードが一致しません。')
  })

  test('Step1: 正常入力後「次へ」— Step2 に進む', async ({ page }) => {
    await page.getByTestId('name-input').fill('テスト太郎')
    await page.getByTestId('email-input').fill('test@example.com')
    await page.getByTestId('password-input').fill('password123')
    await page.getByTestId('password-confirm-input').fill('password123')
    await page.getByTestId('next-button').click()

    await expect(page.getByTestId('signup-step2-form')).toBeVisible()
  })

  test('Step2: 「戻る」クリック — Step1 に戻る', async ({ page }) => {
    await page.getByTestId('name-input').fill('テスト太郎')
    await page.getByTestId('email-input').fill('test@example.com')
    await page.getByTestId('password-input').fill('password123')
    await page.getByTestId('password-confirm-input').fill('password123')
    await page.getByTestId('next-button').click()

    await page.getByTestId('back-button').click()

    await expect(page.getByTestId('signup-step1-form')).toBeVisible()
  })

  test('Step2: 組織名空のまま「登録する」— エラーが表示される', async ({ page }) => {
    await page.getByTestId('name-input').fill('テスト太郎')
    await page.getByTestId('email-input').fill('test@example.com')
    await page.getByTestId('password-input').fill('password123')
    await page.getByTestId('password-confirm-input').fill('password123')
    await page.getByTestId('next-button').click()

    await page.getByTestId('submit-button').click()

    await expect(page.getByTestId('error-message')).toHaveText('組織名を入力してください。')
  })

  test('Step2: 招待コード選択で招待コード空のまま「登録する」— エラーが表示される', async ({
    page,
  }) => {
    await page.getByTestId('name-input').fill('テスト太郎')
    await page.getByTestId('email-input').fill('test@example.com')
    await page.getByTestId('password-input').fill('password123')
    await page.getByTestId('password-confirm-input').fill('password123')
    await page.getByTestId('next-button').click()

    await page.getByTestId('org-join-radio').click()
    await page.getByTestId('submit-button').click()

    await expect(page.getByTestId('error-message')).toHaveText('招待コードを入力してください。')
  })

  test('「ログイン」リンクをクリック — /login へ遷移する', async ({ page }) => {
    await page.getByRole('link', { name: 'ログイン' }).click()

    await expect(page).toHaveURL('/login')
  })

  test('/signup?redirect=/invite/token123 — Step2 の招待コードが自動入力される', async ({
    page,
  }) => {
    await page.goto('/signup?redirect=/invite/token123')

    await page.getByTestId('name-input').fill('テスト太郎')
    await page.getByTestId('email-input').fill('test@example.com')
    await page.getByTestId('password-input').fill('password123')
    await page.getByTestId('password-confirm-input').fill('password123')
    await page.getByTestId('next-button').click()

    await expect(page.getByTestId('org-join-radio')).toBeChecked()
    await expect(page.getByTestId('invite-token-input')).toHaveValue('token123')
  })
})
