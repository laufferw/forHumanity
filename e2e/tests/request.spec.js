const { test, expect } = require('@playwright/test');
const { uid, submitRequest, logInAsAdmin } = require('./helpers');

test('anyone can request a blanket with their current location', async ({ page }) => {
  await submitRequest(page, { name: `Sam ${uid()}`, address: 'Civic Center Park' });
});

test('the request form needs the data-sharing consent', async ({ page }) => {
  await page.goto('/request');
  await page.getByLabel('Your name').fill('Sam');
  await page.getByLabel('Phone').fill('555');
  await page.getByPlaceholder('Address or nearby landmark').fill('Somewhere');
  const submit = page.getByRole('button', { name: 'Submit request' });
  await expect(submit).toBeDisabled();
  await page.getByRole('checkbox').check();
  await expect(submit).toBeEnabled();
});

test('the honeypot field is off-screen', async ({ page }) => {
  await page.goto('/request');
  const box = await page.locator('.honeypot').boundingBox();
  expect(box === null || box.x < 0).toBeTruthy();
});

test('bot submissions that fill the honeypot are not stored', async ({ page, request }) => {
  const address = `Spam ${uid()}`;
  const res = await request.post(`${process.env.E2E_API_URL}/requests`, {
    data: { name: 'Bot', phone: '1', address, website: 'http://spam.example' },
  });
  expect(res.status()).toBe(201);

  await logInAsAdmin(page);
  await expect(page.locator('.request-card').first()).toBeVisible();
  await expect(page.locator('.request-card', { hasText: address })).toHaveCount(0);
});
