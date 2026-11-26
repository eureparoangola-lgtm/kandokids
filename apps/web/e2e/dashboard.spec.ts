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

test("admin switches features on/off and sets the paid-extra price", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("navigation").getByRole("link", { name: "Funcionalidades" }).click();
  await expect(page.getByRole("heading", { name: "Funcionalidades" })).toBeVisible();

  // Pickup PIN: off by default → included
  const pin = page.locator("article", { hasText: "PIN de entrega" });
  await expect(pin.getByRole("radio", { checked: true })).toHaveText("Desligado");
  await pin.getByRole("radio", { name: "Incluído" }).click();
  await expect(pin.getByText("Guardado ✓")).toBeVisible();

  // Live tracking cannot be sold as an extra
  const tracking = page.locator("article", { hasText: "Localização em tempo real" });
  await expect(tracking.getByRole("radio")).toHaveText(["Desligado", "Incluído"]);

  // SMS is a paid extra: change its monthly price
  const sms = page.locator("article", { hasText: "SMS na recolha e na chegada" });
  await expect(sms.getByRole("radio", { checked: true })).toHaveText("Extra pago");
  await sms.getByRole("spinbutton").fill("2000");
  await sms.getByRole("button", { name: "Guardar preço" }).click();
  await expect(sms.getByText("Guardado ✓")).toBeVisible();

  // Persisted after reload
  await page.reload();
  await expect(pin.getByRole("radio", { checked: true })).toHaveText("Incluído");
  await expect(sms.getByRole("spinbutton")).toHaveValue("2000");

  // Turn the chat off and back on
  const chat = page.locator("article", { hasText: "Mensagens com a viatura" });
  await chat.getByRole("radio", { name: "Desligado" }).click();
  await expect(chat.getByText("Guardado ✓")).toBeVisible();
  await chat.getByRole("radio", { name: "Incluído" }).click();
  await expect(chat.getByText("Guardado ✓")).toBeVisible();
});

test("admin confirms a parent's payment for a paid extra", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole("navigation").getByRole("link", { name: /Extras pagos/ }).click();
  await expect(page.getByRole("heading", { name: "Extras pagos" })).toBeVisible();

  const joana = page.locator("li", { hasText: "Joana Neto" });
  await expect(joana).toContainText("SMS na recolha e na chegada");
  await joana.getByLabel("Meses").selectOption("3");
  await joana.getByLabel("Referência do pagamento").fill("MCX-554433");
  await joana.getByRole("button", { name: "Confirmar pagamento" }).click();

  const row = page.locator("tbody tr", { hasText: "Joana Neto" });
  await expect(row).toContainText("Ativo");
  await expect(row).toContainText(/4\s500\sKz/);
});

test("dashboard fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsAdmin(page);
  await page.goto("/painel/funcionalidades");
  await expect(page.getByRole("heading", { name: "Funcionalidades" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
