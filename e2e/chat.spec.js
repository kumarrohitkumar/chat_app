import { expect, test } from "@playwright/test";

const RUN = Date.now().toString(36);
const PASSWORD = "E2e@Pass123";
const PEOPLE = { asha: `Asha ${RUN}`, bilal: `Bilal ${RUN}`, chetan: `Chetan ${RUN}` };
const email = (who) => `e2e.${who}.${RUN}@example.com`;
const PNG = { name: "photo.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==", "base64") };

async function signUp(browser, who) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/signup");
  await page.getByLabel("Full Name").fill(PEOPLE[who]);
  await page.getByLabel("Email").fill(email(who));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByRole("button", { name: "Start a new chat" })).toBeVisible();
  return { context, page };
}

const sidebarChat = (page, name) => page.getByRole("button", { name: new RegExp(name) }).first();
const composer = (page) => page.getByLabel("Message text");
// The newest match is the bubble in the open chat; the sidebar preview comes first in the page.
const bubble = (page, text) => page.getByText(text, { exact: true }).last();
async function send(page, text) {
  await composer(page).fill(text);
  await page.getByLabel("Send message").click();
}

test.describe.serial("chat end to end", () => {
  let asha, bilal, chetan;

  test.beforeAll(async ({ browser }) => {
    asha = await signUp(browser, "asha");
    bilal = await signUp(browser, "bilal");
    chetan = await signUp(browser, "chetan");
  });
  test.afterAll(async () => {
    for (const p of [asha, bilal, chetan]) await p?.context.close();
  });

  test("new chat lists people by name, finds an exact email, and never shows emails", async () => {
    const { page } = asha;
    await page.getByRole("button", { name: "Start a new chat" }).click();
    const dialog = page.getByRole("dialog", { name: "Start a new chat" });
    await dialog.getByLabel("Search people").fill(PEOPLE.bilal);
    await expect(dialog.getByRole("button", { name: new RegExp(PEOPLE.bilal) })).toBeVisible();
    await expect(dialog).not.toContainText("@example.com");
    await dialog.getByLabel("Search people").fill(email("chetan").toUpperCase());
    await expect(dialog.getByRole("button", { name: new RegExp(PEOPLE.chetan) })).toBeVisible();
    await dialog.getByLabel("Close").click();
  });

  test("a direct message arrives live, with typing and Seen receipts", async () => {
    await asha.page.getByRole("button", { name: "Start a new chat" }).click();
    const dialog = asha.page.getByRole("dialog", { name: "Start a new chat" });
    await dialog.getByLabel("Search people").fill(PEOPLE.bilal);
    await dialog.getByRole("button", { name: new RegExp(PEOPLE.bilal) }).click();
    await expect(dialog).toBeHidden();
    await expect(composer(asha.page)).toHaveAttribute("placeholder", `Message ${PEOPLE.bilal}`);
    await send(asha.page, "Hi Bilal, are you around?");

    await sidebarChat(bilal.page, PEOPLE.asha).click();
    await expect(composer(bilal.page)).toHaveAttribute("placeholder", `Message ${PEOPLE.asha}`);
    await expect(bubble(bilal.page, "Hi Bilal, are you around?")).toBeVisible();
    await expect(asha.page.getByText("Seen").last()).toBeVisible();

    await composer(bilal.page).pressSequentially("Yes", { delay: 60 });
    await expect(asha.page.getByText(/typing/i).first()).toBeVisible();
    await bilal.page.getByLabel("Send message").click();
    await expect(bubble(asha.page, "Yes")).toBeVisible();
  });

  test("a photo message is delivered and served from the app", async () => {
    await asha.page.locator('input[type="file"]').setInputFiles(PNG);
    await expect(asha.page.getByAltText("Attachment preview")).toBeVisible();
    await asha.page.getByLabel("Send message").click();
    const img = bilal.page.getByAltText("Attachment").last();
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute("src", /\/api\/media\/messages\//);
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  });

  test("messages sent while offline show up after reconnecting", async () => {
    await bilal.context.setOffline(true);
    await bilal.page.waitForTimeout(1500);
    await send(asha.page, "Sent while you were offline");
    await bilal.context.setOffline(false);
    await expect(bubble(bilal.page, "Sent while you were offline")).toBeVisible({ timeout: 30_000 });
  });

  test("deleting a message updates both screens; deleting a chat clears it for me only", async () => {
    await send(asha.page, "Please ignore this one");
    await expect(bubble(bilal.page, "Please ignore this one")).toBeVisible();

    const row = asha.page.locator(".chat").filter({ hasText: "Please ignore this one" }).last();
    await row.hover();
    await row.getByLabel("Delete message").click();
    await asha.page.getByRole("alertdialog", { name: "Delete message" }).getByRole("button", { name: "Delete" }).click();
    await expect(bubble(asha.page, "You deleted this message")).toBeVisible();
    await expect(bubble(bilal.page, "This message was deleted")).toBeVisible();
    await expect(bilal.page.getByText("Please ignore this one")).toHaveCount(0);

    await asha.page.getByLabel("Delete chat").click();
    await asha.page.getByRole("alertdialog", { name: "Delete chat" }).getByRole("button", { name: "Delete chat" }).click();
    await expect(sidebarChat(asha.page, PEOPLE.bilal)).toHaveCount(0);
    // Bilal still has the whole conversation.
    await expect(bubble(bilal.page, "Yes")).toBeVisible();

    // A new message brings the chat back for Asha, with only the new message.
    await send(bilal.page, "Back again");
    await sidebarChat(asha.page, PEOPLE.bilal).click();
    await expect(bubble(asha.page, "Back again")).toBeVisible();
    await expect(asha.page.getByText("Hi Bilal, are you around?")).toHaveCount(0);
  });

  test("a group: create, chat, Seen by all, then remove someone with confirmation", async () => {
    const groupName = `E2E squad ${RUN}`;
    await asha.page.getByRole("button", { name: "Start a new chat" }).click();
    const dialog = asha.page.getByRole("dialog", { name: "Start a new chat" });
    await dialog.getByRole("tab", { name: "Group" }).click();
    await dialog.getByLabel("Group name").fill(groupName);
    for (const who of ["bilal", "chetan"]) {
      await dialog.getByLabel("Search people").fill(PEOPLE[who]);
      await dialog.getByRole("button", { name: new RegExp(PEOPLE[who]) }).click();
    }
    await dialog.getByRole("button", { name: "Create group" }).click();
    await expect(dialog).toBeHidden();
    await expect(asha.page.getByLabel("Message text")).toHaveAttribute("placeholder", `Message ${groupName}`);
    await send(asha.page, "Welcome to the squad");

    for (const p of [bilal, chetan]) {
      await sidebarChat(p.page, groupName).click();
      await expect(bubble(p.page, "Welcome to the squad")).toBeVisible();
    }
    await expect(asha.page.getByText("Seen by all").last()).toBeVisible();

    await asha.page.getByLabel("Group details").click();
    const panel = asha.page.getByRole("dialog", { name: "Group details" });
    await panel.getByLabel(`Remove ${PEOPLE.chetan}`).click();
    await expect(panel.getByRole("alertdialog")).toContainText(`Remove ${PEOPLE.chetan}`);
    await panel.getByRole("button", { name: "Remove", exact: true }).click();

    await expect(bubble(chetan.page, "You were removed from this group")).toBeVisible();
    await expect(sidebarChat(chetan.page, groupName)).toHaveCount(0);
    await expect(bilal.page.getByText(new RegExp(`removed ${PEOPLE.chetan}`)).last()).toBeVisible();
  });
});
