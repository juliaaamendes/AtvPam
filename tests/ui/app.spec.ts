import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 360, height: 800 },
  { width: 844, height: 390 },
  { width: 1280, height: 800 },
]) {
  test(`layout e rascunho ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.getByText("Cada visita,")).toBeVisible();
    await page.getByRole("tab", { name: "Nova visita" }).click();
    await page
      .getByRole("textbox", { name: "Propriedade *", exact: true })
      .fill("Fazenda Boa Vista");
    await page
      .getByRole("textbox", { name: "Responsável técnico *", exact: true })
      .fill("Ana");
    await page.getByRole("tab", { name: "Histórico" }).click();
    await expect(
      page.getByText("Suas visitas concluídas aparecerão aqui."),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Nova visita" }).click();
    await expect(
      page.getByRole("textbox", { name: "Propriedade *", exact: true }),
    ).toHaveValue("Fazenda Boa Vista");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
    await expect(
      page.getByRole("button", { name: "Concluir e salvar visita" }),
    ).toBeEnabled();
    expect(errors).toEqual([]);
    await page.screenshot({
      path: `test-results/form-${viewport.width}.png`,
      fullPage: true,
    });
  });
}

test("navegador explica a indisponibilidade nativa sem gravar uma visita", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Nova visita" }).click();
  await page
    .getByRole("textbox", { name: "Propriedade *", exact: true })
    .fill("Fazenda Teste");
  await page
    .getByRole("textbox", { name: "Responsável técnico *", exact: true })
    .fill("Ana");
  const messages: string[] = [];
  page.on("dialog", async (dialog) => {
    messages.push(dialog.message());
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Fotografar", exact: true }).click();
  await expect.poll(() => messages.length).toBe(1);
  expect(messages[0]).toContain("câmera nativa");
  await page.getByRole("button", { name: "Concluir e salvar visita" }).click();
  await expect.poll(() => messages.length).toBe(3);
  expect(messages[2]).toContain("acelerômetro nativo");
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(
    page.getByText("Suas visitas concluídas aparecerão aqui."),
  ).toBeVisible();
});
