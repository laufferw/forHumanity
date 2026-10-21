const { test, expect } = require('@playwright/test');
const { uid, BOULDER, submitRequest, logIn, logInAsAdmin, register } = require('./helpers');

// One volunteer's journey, from sign-up to delivery to suspension. Steps
// share state, so they run in order and stop at the first failure.
test.describe.serial('volunteer lifecycle', () => {
  const id = uid();
  const volunteer = {
    name: `Vera ${id}`,
    email: `vera-${id}@example.info`,
    password: 'Vera123!pw',
  };
  const near = `Civic Center ${id}`;
  const far = `Boulder Creek ${id}`;

  /** @type {import('@playwright/test').Page} */ let admin;
  /** @type {import('@playwright/test').Page} */ let vol;

  test.beforeAll(async ({ browser }) => {
    const denver = await browser.newPage();
    await submitRequest(denver, { name: 'Sam', address: near });
    await denver.close();

    const boulder = await browser.newContext({
      geolocation: BOULDER,
      permissions: ['geolocation'],
    });
    await submitRequest(await boulder.newPage(), { name: 'Bo', address: far });
    await boulder.close();

    admin = await (await browser.newContext()).newPage();
    vol = await (await browser.newContext()).newPage();
    vol.on('dialog', (d) => d.accept());
    admin.on('dialog', (d) => d.accept());
  });

  test('a new volunteer starts pending with limited access', async () => {
    await register(vol, volunteer);
    await expect(vol.getByRole('heading', { name: 'My requests' })).toBeVisible();
    await expect(vol.getByText(/admin will review your account/)).toBeVisible();
    await expect(vol.getByRole('link', { name: 'Assignments' })).toHaveCount(0);
  });

  test('admins cannot assign pending volunteers until they approve them', async () => {
    await logInAsAdmin(admin);
    const card = admin.locator('.request-card', { hasText: near });
    await expect(
      card.getByLabel('Volunteer').locator('option', { hasText: volunteer.name })
    ).toHaveCount(0);

    await admin.getByRole('tab', { name: /Users/ }).click();
    const row = admin.locator('.request-card', { hasText: volunteer.email });
    await row.getByRole('button', { name: 'Approve' }).click();
    await expect(row.locator('.badge', { hasText: 'active' })).toBeVisible();
  });

  test('admins sort by distance and assign both requests', async () => {
    await admin.getByRole('tab', { name: 'Requests' }).click();
    await admin.getByRole('button', { name: 'Sort by distance from me' }).click();
    await expect(admin.getByRole('button', { name: 'Sort by newest' })).toBeVisible();

    const titles = await admin.locator('.request-card strong').allTextContents();
    expect(titles.indexOf(near)).toBeLessThan(titles.indexOf(far));
    await expect(admin.locator('.request-card', { hasText: far })).toContainText(/\d+\.\d km away/);

    for (const place of [near, far]) {
      const card = admin.locator('.request-card', { hasText: place });
      await card.getByLabel('Volunteer').selectOption({ label: volunteer.name });
      await expect(card.getByText(`Assigned to ${volunteer.name}`)).toBeVisible();
    }
  });

  test('the approved volunteer delivers the nearby request', async () => {
    await vol.reload();
    await vol.getByRole('link', { name: 'Assignments' }).click();
    const job = vol.locator('.request-card', { hasText: near });
    await expect(job).toContainText('555-0100');
    await expect(job.getByRole('link', { name: 'Open in maps' })).toHaveAttribute(
      'href',
      /39\.7392,-104\.9903/
    );

    await job.getByRole('button', { name: 'Start delivery' }).click();
    await expect(job.locator('.badge', { hasText: 'In progress' })).toBeVisible();
    await job.getByRole('button', { name: 'Mark delivered' }).click();
    await expect(job).toHaveCount(0);
    await expect(vol.locator('.request-card', { hasText: far })).toBeVisible();
  });

  test('suspending the volunteer logs them out and releases open work', async () => {
    await admin.getByRole('tab', { name: /Users/ }).click();
    const row = admin.locator('.request-card', { hasText: volunteer.email });
    await row.getByLabel('Status').selectOption('suspended');
    await expect(row.locator('.badge', { hasText: 'suspended' })).toBeVisible();

    await admin.getByRole('tab', { name: 'Requests' }).click();
    const open = admin.locator('.request-card', { hasText: far });
    await expect(open.getByLabel('Volunteer')).toHaveValue('');
    await expect(open.getByText(/Assigned to/)).toHaveCount(0);
    await expect(
      admin.locator('.request-card', { hasText: near }).getByText(`Assigned to ${volunteer.name}`)
    ).toBeVisible();

    await vol.reload();
    await expect(vol.getByRole('heading', { name: 'Log in' })).toBeVisible();
  });

  test('a volunteer cannot open the admin dashboard', async () => {
    await admin.getByRole('tab', { name: /Users/ }).click();
    const row = admin.locator('.request-card', { hasText: volunteer.email });
    await row.getByLabel('Status').selectOption('active');
    await expect(row.locator('.badge', { hasText: 'active' })).toBeVisible();

    await logIn(vol, volunteer.email, volunteer.password);
    await expect(vol.getByRole('heading', { name: 'My assignments' })).toBeVisible();
    await vol.goto('/admin');
    await expect(vol.getByRole('heading', { name: 'Community blanket support' })).toBeVisible();
  });
});

test('requesters who are logged in can track and cancel their requests', async ({ page }) => {
  const id = uid();
  page.on('dialog', (d) => d.accept());
  await register(page, {
    name: `Rae ${id}`,
    email: `rae-${id}@example.com`,
    password: 'Rae123!pw',
  });
  await expect(page.getByRole('heading', { name: 'My requests' })).toBeVisible();

  await page.getByRole('link', { name: 'Request Help' }).click();
  await expect(page.getByLabel('Your name')).toHaveValue(`Rae ${id}`);
  const address = `Union Station ${id}`;
  await page.getByLabel('Phone').fill('555-0200');
  await page.getByPlaceholder('Address or nearby landmark').fill(address);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Submit request' }).click();
  await page.getByRole('link', { name: 'Track it in My requests.' }).click();

  const card = page.locator('.request-card', { hasText: address });
  await card.getByRole('button', { name: 'Cancel request' }).click();
  await expect(card.locator('.badge', { hasText: 'Cancelled' })).toBeVisible();
});
