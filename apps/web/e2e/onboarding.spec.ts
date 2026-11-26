import { expect, test } from "@playwright/test";

// A brand-new transport company starts on its own, on the free plan.
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const email = `dono+${stamp}@novaempresa.ao`;

const CSV = [
  "Nome;Classe;Escola;Morada;Encarregado;Telefone;Parentesco",
  ...Array.from({ length: 15 }, (_, i) => `Aluno ${i + 1};4ª classe;Escola Primária Nova;Camama;Pai ${i + 1};+244 931 100 ${String(i + 1).padStart(3, "0")};Pai`),
].join("\n");

test("company signs up, imports students, invites staff and gets today's trip", async ({ page }) => {
  test.setTimeout(90_000);

  // Sign-up
  await page.goto("/registar");
  await page.getByLabel("Nome da empresa *").fill("Bento Transportes");
  await page.getByLabel("Telefone *").fill("+244 924 000 000");
  await page.getByLabel("O seu nome *").fill("Carlos Bento");
  await page.getByLabel("Email *").fill(email);
  await page.getByLabel(/Palavra-passe/).fill("kandokids123");
  await page.getByRole("button", { name: "Criar conta grátis" }).click();
  await expect(page.getByText("Primeiros passos (0/5)")).toBeVisible();
  await expect(page.getByText(/Plano gratuito/).first()).toBeVisible();
  await expect(page.getByText("Bento Transportes").first()).toBeVisible();

  // Vehicle (the free plan allows one)
  await page.getByRole("navigation").getByRole("link", { name: "Viaturas" }).click();
  await page.getByLabel("Matrícula *").fill("ld-11-22-ef");
  await page.getByLabel("Nome (como os pais a conhecem)").fill("Hiace Verde");
  await page.getByRole("button", { name: "Adicionar viatura" }).click();
  await expect(page.getByText("Viatura LD-11-22-EF adicionada.")).toBeVisible();
  await page.getByLabel("Matrícula *").fill("LD-99-99-ZZ");
  await page.getByRole("button", { name: "Adicionar viatura" }).click();
  await expect(page.getByText(/plano gratuito inclui 1 viatura/)).toBeVisible();

  // Import 15 students from a CSV file
  await page.getByRole("navigation").getByRole("link", { name: "Alunos" }).click();
  await page.getByLabel("Ficheiro Excel ou CSV").setInputFiles({ name: "alunos.csv", mimeType: "text/csv", buffer: Buffer.from(CSV, "utf-8") });
  await expect(page.getByText("15 alunos encontrados.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Importar 15 alunos" }).click();
  await expect(page.getByText("15 alunos importados.", { exact: false })).toBeVisible();
  const wa = page.getByRole("link", { name: "Enviar por WhatsApp" }).first();
  await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/244931100001\?text=.*Bento%20Transportes.*c%C3%B3digo%20[0-9A-F]{8}/);

  // The 16th student is refused on the free plan
  await page.getByLabel("Nome do aluno *").fill("Aluno 16");
  await page.getByRole("button", { name: "Adicionar aluno" }).click();
  await expect(page.getByText(/até 15 alunos/)).toBeVisible();

  // Invite the vehicle assistant
  await page.getByRole("navigation").getByRole("link", { name: "Equipa" }).click();
  await page.getByLabel("Nome *").fill("Lúcia Mendes");
  await page.getByLabel("Telefone").fill("+244 924 000 002");
  await page.getByRole("button", { name: "Criar convite" }).click();
  await expect(page.getByText(/Convite criado para Lúcia Mendes/)).toBeVisible();
  await expect(page.getByText("convite pendente", { exact: false })).toBeVisible();

  // Route with the vehicle and all students, every day of the week
  await page.getByRole("navigation").getByRole("link", { name: "Rotas" }).click();
  const form = page.locator("section", { hasText: "Nova rota" });
  await form.getByLabel("Nome *").fill("Camama → Escola (manhã)");
  await form.getByLabel("Hora de partida").fill("06:45");
  await form.getByLabel("Viatura *").selectOption({ label: "Hiace Verde · LD-11-22-EF" });
  for (const day of ["Sáb", "Dom"]) await form.getByLabel(day).check();
  for (let i = 1; i <= 15; i++) await form.getByLabel(`Aluno ${i}`, { exact: true }).check();
  await form.getByRole("button", { name: "Criar rota" }).click();
  await expect(page.getByText("Rota criada.")).toBeVisible();
  await expect(page.getByText("15 alunos · Hiace Verde · LD-11-22-EF")).toBeVisible();

  await page.getByRole("button", { name: "Criar as viagens de hoje agora" }).click();
  await expect(page.getByText("1 viagem(ns) criada(s) para hoje.")).toBeVisible();

  // Home: today's trip and the checklist progress
  await page.getByRole("navigation").getByRole("link", { name: "Início" }).click();
  await expect(page.getByText("Camama → Escola (manhã)")).toBeVisible();
  await expect(page.getByText("0 a bordo · 15 crianças")).toBeVisible();
  await expect(page.getByText("Primeiros passos (3/5)")).toBeVisible();
});

test("Pro plan request", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill("kandokids123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.getByRole("link", { name: "Passar para o plano Pro" }).click();
  await page.getByRole("button", { name: "Pedir plano Pro" }).click();
  await expect(page.getByText(/Pedido enviado/)).toBeVisible();
});
