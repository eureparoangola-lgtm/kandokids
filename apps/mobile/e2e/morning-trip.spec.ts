import { expect, test, type Browser, type Page } from "@playwright/test";

// A full morning trip, seen by the vehicle assistant and by a parent at the same time.
// Demo data: supabase/seed.sql (password kandokids123).

async function openAs(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill("kandokids123");
  await page.getByRole("button", { name: "Entrar" }).click();
  return page;
}

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email").fill("joana@exemplo.ao");
  await page.getByLabel("Palavra-passe").fill("errada");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toHaveText("Email ou palavra-passe incorretos.");
});

test("morning trip: assistant and parent", async ({ browser }) => {
  test.setTimeout(120_000);

  // --- Assistant starts the trip
  const crew = await openAs(browser, "teresa@kianda.ao");
  await expect(crew.getByText("As suas viagens de hoje.")).toBeVisible();
  await expect(crew).toHaveURL(/\/assistente$/);
  await crew.getByText("Kilamba → Colégio (manhã)").click();
  await crew.getByRole("button", { name: /Iniciar viagem/ }).click();
  await expect(crew.getByText("Viagem iniciada. Os pais foram avisados.")).toBeVisible();
  await expect(crew.getByTestId("gps-state")).toContainText("GPS ativo", { timeout: 15_000 });

  // --- Parent sees the children and the vehicle on the map
  const parent = await openAs(browser, "joana@exemplo.ao");
  await expect(parent).toHaveURL(/\/encarregado$/);
  const ana = parent.getByTestId("child-Ana");
  await expect(ana).toContainText("A viatura Autocarro Azul está a caminho.");
  await expect(parent.getByTestId("child-Miguel")).toBeVisible();
  await expect(parent.getByTestId("child-Rita")).toHaveCount(0); // not her child
  await ana.click();
  await expect(parent.getByTestId("vehicle-map")).toBeVisible();
  await expect(parent.getByText(/Posição atualizada/)).toBeVisible({ timeout: 20_000 });

  // --- QR scan: wrong vehicle is refused, right child is checked in
  await crew.getByRole("button", { name: /Ler cartão/ }).click();
  const code = crew.getByLabel("Código do cartão");
  await code.fill("demo-kiame");
  await crew.getByRole("button", { name: "Registar código" }).click();
  await expect(crew.getByRole("alert")).toContainText("Deve ir na viatura Carrinha Branca");
  await code.fill("demo-ana");
  await crew.getByRole("button", { name: "Registar código" }).click();
  await expect(crew.getByText("Ana Neto a bordo ✓")).toBeVisible();
  await crew.getByRole("button", { name: "Voltar à lista" }).click();

  await parent.reload();
  await expect(parent.getByText(/Ana está na viatura Autocarro Azul desde as/).first()).toBeVisible();

  // --- Parent: Miguel is not going today
  await parent.goBack();
  await parent.getByTestId("child-Miguel").click();
  await parent.getByLabel("Vai à escola hoje").click();
  await expect(parent.getByText("Miguel não vai hoje.")).toBeVisible();

  // --- Parent messages the vehicle
  await parent.goBack();
  await parent.getByTestId("child-Ana").click();
  await parent.getByRole("button", { name: /Enviar mensagem à viatura/ }).click();
  await parent.getByLabel("Mensagem", { exact: true }).fill("A Ana leva a mochila azul hoje.");
  await parent.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(parent.getByText("A Ana leva a mochila azul hoje.")).toBeVisible();

  // --- Assistant: Miguel removed from the list, sees the message, delivers Ana, ends the trip
  await crew.reload();
  await expect(crew.getByTestId("student-Miguel Neto")).toContainText("Ausente");
  await expect(crew.getByTestId("student-Ana Neto")).toContainText("A bordo");

  await crew.getByTestId("student-Ana Neto").getByRole("button", { name: /Entregue na escola/ }).click();
  await crew.getByRole("button", { name: "Confirmar entrega na escola" }).click();
  await expect(crew.getByText("Ana Neto entregue.")).toBeVisible();

  // Ending is blocked until the empty-vehicle check is ticked
  await crew.getByTestId("student-Rita Domingos").getByRole("button", { name: /Não apareceu/ }).click();
  await crew.getByRole("button", { name: /Terminar viagem/ }).click();
  const confirm = crew.getByRole("button", { name: "Terminar viagem" }).last();
  await expect(confirm).toBeDisabled();
  await crew.getByRole("checkbox").click();
  await confirm.click();
  await expect(crew.getByText(/Viagem terminada/)).toBeVisible();

  // --- Parent is notified of the arrival
  await parent.goto("/encarregado/notificacoes");
  await expect(parent.getByText("Ana chegou à escola").first()).toBeVisible();
  await expect(parent.getByText("A viatura está a chegar").first()).toBeVisible();

  // --- Assistant is notified of the message and reads it
  await crew.goto("/encarregado/notificacoes");
  await expect(crew.getByText(/Joana Neto: A Ana leva a mochila azul hoje\./)).toBeVisible();
  await expect(crew.getByText(/Miguel não vai hoje/)).toBeVisible();
  await crew.goto("/assistente/mensagens");
  await expect(crew.getByText("A Ana leva a mochila azul hoje.")).toBeVisible();
});

test("parent requests a paid extra", async ({ browser }) => {
  const parent = await openAs(browser, "paulo@exemplo.ao");
  await expect(parent).toHaveURL(/\/encarregado$/);
  await parent.getByRole("button", { name: /Extras/ }).click();
  const sms = parent.getByTestId("extra-sms_alerts");
  await expect(sms).toContainText("SMS na recolha e na chegada");
  await sms.getByRole("button", { name: "Quero este extra" }).click();
  await expect(parent.getByRole("alert")).toContainText("Pedido enviado");
  await expect(sms).toContainText("Aguarda pagamento");
  await expect(parent.getByTestId("payment-instructions")).toContainText("Multicaixa Express");
});

test("new parent and new assistant sign up with invite codes", async ({ page, browser }) => {
  const stamp = Date.now();

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Tenho um código de convite" })).toBeVisible();
  // Invite link from WhatsApp: the code comes pre-filled
  await page.goto("/registo?codigo=demopais");
  await expect(page.getByLabel("Código de convite", { exact: true })).toHaveValue("DEMOPAIS");
  await expect(page.getByText(/já está preenchido/)).toBeVisible();
  await page.getByLabel("Nome completo").fill("Maria Domingos");
  await page.getByLabel("Email").fill(`maria+${stamp}@exemplo.ao`);
  await page.getByLabel("Palavra-passe").fill("kandokids123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/encarregado$/);
  await expect(page.getByTestId("child-Kiame")).toBeVisible();

  const ctx = await browser.newContext();
  const staff = await ctx.newPage();
  await staff.goto("/registo");
  await staff.getByLabel("Código de convite", { exact: true }).fill("DEMOEQUI");
  await staff.getByLabel("Nome completo").fill("Nova Assistente");
  await staff.getByLabel("Email").fill(`assistente+${stamp}@kianda.ao`);
  await staff.getByLabel("Palavra-passe").fill("kandokids123");
  await staff.getByRole("button", { name: "Criar conta" }).click();
  await expect(staff).toHaveURL(/\/assistente$/);
  await expect(staff.getByText("As suas viagens de hoje.")).toBeVisible();
});

test("after confirming the email, the first login links the child automatically", async ({ browser }) => {
  // rosa@exemplo.ao signed up with code DEMOPEND and confirmed her email (see seed.sql)
  const parent = await openAs(browser, "rosa@exemplo.ao");
  await expect(parent).toHaveURL(/\/encarregado$/);
  await expect(parent.getByTestId("child-Rita")).toBeVisible();
});

test("confirmation link lands on login with a success message", async ({ page }) => {
  await page.goto("/login?confirmado=1");
  await expect(page.getByText("Email confirmado!")).toBeVisible();
});
