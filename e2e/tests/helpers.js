const { expect } = require('@playwright/test');
const { ADMIN } = require('../global-setup');

// Unique per test run so specs don't depend on each other's data.
const uid = () => Math.random().toString(36).slice(2, 8);

const BOULDER = { latitude: 40.015, longitude: -105.2705 };

async function submitRequest(page, { name, address, useLocation = true }) {
  await page.goto('/request');
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Phone').fill('555-0100');
  await page.getByPlaceholder('Address or nearby landmark').fill(address);
  if (useLocation) {
    await page.getByRole('button', { name: 'Use my current location' }).click();
    await expect(page.getByText(/Location attached/)).toBeVisible();
  }
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Submit request' }).click();
  await expect(page.getByText(/sent to volunteers/)).toBeVisible();
}

async function logIn(page, email, password) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

const logInAsAdmin = async (page) => {
  await logIn(page, ADMIN.email, ADMIN.password);
  await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toBeVisible();
};

async function register(page, { name, email, password }) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).last().click();
}

module.exports = { uid, BOULDER, submitRequest, logIn, logInAsAdmin, register };
