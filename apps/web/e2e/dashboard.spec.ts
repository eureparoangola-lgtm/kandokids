import { expect, test, type Page } from "@playwright/test";

// Demo data comes from supabase/seed.sql (password for every user: kandokids123).

async function login(page: Page, email = "admin@kianda.ao", password = "kandokids123") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/** Logs in and waits until the dashboard has loaded. */
async function loginAsAdmin(page: Page) {
  await login(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Bom dia/);
}

test.describe.configure({ mode: "serial" });

test("redirects to login and keeps the email after a wrong password", async ({ page }) => {
  await page.goto("/painel");
  await expect(page).toHaveURL(/\/login\?next=%2Fpainel/);

  await login(page, "admin@kianda.ao", "errada");
  await expect(page.locator('p[role="alert"]')).toHaveText("Email ou palavra-passe incorretos.");
  await expect(page.getByLabel("Email")).toHaveValue("admin@kianda.ao");
});

test("parents cannot open the management dashboard", async ({ page }) => {
  await login(page, "joana@exemplo.ao");
  await expect(page.locator('p[role="alert"]')).toContainText("não tem acesso ao painel");
});

test("home shows today's trips", async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.getByText("Kilamba → Colégio (manhã)")).toBeVisible();
  await expect(page.getByText("0 a bordo · 1 criança", { exact: true })).toBeVisible();
});

test("company admin switches features on/off, and never sees the paid extras", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("navigation").getByRole("link", { name: "Funcionalidades" }).click();
  await expect(page.getByRole("heading", { name: "Funcionalidades" })).toBeVisible();

  // Pickup PIN: off by default → on
  const pin = page.locator("article", { hasText: "PIN de entrega" });
  await expect(pin.getByRole("radio", { checked: true })).toHaveText("Desligado");
  await pin.getByRole("radio", { name: "Ativo" }).click();
  await expect(pin.getByText("Guardado ✓")).toBeVisible();
  await page.reload();
  await expect(pin.getByRole("radio", { checked: true })).toHaveText("Ativo");

  // Paid extras are sold by Kandokids: not shown to companies
  await expect(page.getByText("SMS na recolha e na chegada")).toHaveCount(0);
  await expect(page.getByText("Alertas de excesso de velocidade")).toHaveCount(0);
  await expect(page.getByText("Extra pago")).toHaveCount(0);
  await expect(page.getByRole("navigation").getByRole("link", { name: /Extras/ })).toHaveCount(0);

  // Turn the chat off and back on
  const chat = page.locator("article", { hasText: "Mensagens com a viatura" });
  await chat.getByRole("radio", { name: "Desligado" }).click();
  await expect(chat.getByText("Guardado ✓")).toBeVisible();
  await chat.getByRole("radio", { name: "Ativo" }).click();
  await expect(chat.getByText("Guardado ✓")).toBeVisible();
});

test("company admins cannot open the Kandokids platform", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/plataforma");
  await expect(page).toHaveURL(/\/painel$/);
});

test("dashboard fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsAdmin(page);
  await page.goto("/painel/funcionalidades");
  await expect(page.getByRole("heading", { name: "Funcionalidades" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
