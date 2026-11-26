import { expect, test, type Page } from "@playwright/test";

// Kandokids team: master dashboard. Runs last (it suspends and reactivates a company).
test.describe.configure({ mode: "serial" });

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill("kandokids123");
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("overview shows companies, parents and extras", async ({ page }) => {
  await login(page, "plataforma@kandokids.ao");
  await expect(page).toHaveURL(/\/plataforma$/);
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
  await expect(page.getByText("Pagamentos por confirmar")).toBeVisible();
  await expect(page.locator("div", { hasText: /^\d+Encarregados/ }).first()).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link", { name: /Extras/ })).toContainText("2");
});

test("confirms a parent's payment and changes a price", async ({ page }) => {
  await login(page, "plataforma@kandokids.ao");
  await page.getByRole("navigation").getByRole("link", { name: /Extras/ }).click();
  await expect(page.getByRole("heading", { name: "Extras" })).toBeVisible();

  const joana = page.locator("li", { hasText: "Joana Neto" });
  await expect(joana).toContainText("SMS na recolha e na chegada");
  await joana.getByLabel("Meses").selectOption("3");
  await joana.getByLabel("Referência do pagamento").fill("MCX-554433");
  await joana.getByRole("button", { name: "Confirmar pagamento" }).click();
  const row = page.locator("tbody tr", { hasText: "Joana Neto" });
  await expect(row).toContainText("Ativo");
  await expect(row).toContainText(/4\s500\sKz/);

  const sms = page.getByTestId("catalogo-sms_alerts");
  await sms.getByLabel("Preço mensal (Kz)").fill("2000");
  await sms.getByRole("button", { name: "Guardar" }).click();
  await expect(sms.getByText("Guardado para todas as empresas.")).toBeVisible();
});

test("parents list and search", async ({ page }) => {
  await login(page, "plataforma@kandokids.ao");
  await page.getByRole("navigation").getByRole("link", { name: "Encarregados" }).click();
  await page.getByLabel("Pesquisar").fill("Joana");
  await page.getByRole("button", { name: "Pesquisar" }).click();
  const row = page.locator("tbody tr", { hasText: "Joana Neto" });
  await expect(row).toContainText("Ana Neto (Kianda Transportes Escolares)");
  await expect(row).toContainText("SMS na recolha e na chegada");
  await expect(page.locator("tbody tr")).toHaveCount(1);
});

test("payment instructions are saved", async ({ page }) => {
  await login(page, "plataforma@kandokids.ao");
  await page.getByRole("navigation").getByRole("link", { name: "Definições" }).click();
  await page.getByLabel(/Instruções de pagamento/).fill("Pague por Multicaixa Express para o 923 000 000.");
  await page.getByLabel("WhatsApp de apoio").fill("+244 923 000 000");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Definições guardadas.")).toBeVisible();
});

test("suspends a company, which blocks its dashboard, then reactivates it", async ({ page, browser }) => {
  await login(page, "plataforma@kandokids.ao");
  await page.getByRole("navigation").getByRole("link", { name: "Empresas" }).click();
  const kianda = page.getByTestId("empresa-Kianda Transportes Escolares");
  await expect(kianda).toContainText("PRO até");
  await kianda.locator("summary").click();
  await kianda.getByLabel("Motivo *").fill("Falta de pagamento");
  await kianda.getByRole("button", { name: "Suspender" }).click();
  await expect(kianda).toContainText("SUSPENSA");

  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await login(admin, "admin@kianda.ao");
  await expect(admin).toHaveURL(/\/suspensa$/);
  await expect(admin.getByText("Motivo: Falta de pagamento")).toBeVisible();
  await expect(admin.getByText("+244 923 000 000")).toBeVisible();

  await page.reload();
  await kianda.locator("summary").click();
  await kianda.getByRole("button", { name: "Reativar empresa" }).click();
  await expect(kianda).not.toContainText("SUSPENSA");

  await admin.goto("/painel");
  await expect(admin.getByRole("heading", { level: 1 })).toHaveText(/Bom dia/);
});
