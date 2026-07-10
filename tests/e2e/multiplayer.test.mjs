import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const mobileViewport = { width: 390, height: 844 };

function watchConsole(page, label) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${label}: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`${label}: ${error.message}`));
  return errors;
}

function watchSnapshots(page) {
  const snapshots = [];
  page.on("response", async (response) => {
    if (!response.url().includes("/rpc/get_game_snapshot") || !response.ok()) return;
    try {
      snapshots.push(await response.json());
    } catch {
      // A navigation can dispose a response before Playwright reads it. Later
      // snapshot responses still exercise the same participant-safe contract.
    }
  });
  return snapshots;
}

async function currentSnapshot(page) {
  await page.waitForFunction(() => typeof window.render_game_to_text === "function");
  return JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}

async function waitForStatus(page, status) {
  await page.waitForFunction(
    (expected) =>
      typeof window.render_game_to_text === "function" &&
      JSON.parse(window.render_game_to_text()).game.status === expected,
    status,
  );
  return currentSnapshot(page);
}

function playerButton(page, name) {
  return page.getByRole("button", { name: new RegExp(`^${name}(?:,|$)`, "i") });
}

async function hostRoom(browser, { mode, name }) {
  const context = await browser.newContext({ viewport: mobileViewport });
  const page = await context.newPage();
  const errors = watchConsole(page, `host:${mode}`);
  const networkSnapshots = watchSnapshots(page);

  await page.goto(`${baseUrl}/host`);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: mode === "mafia" ? /^mafia$/i : /^chameleon$/i }).click();
  await page.getByRole("button", { name: /create room/i }).click();
  await page.waitForURL(/\/game\/[A-Z2-9]{4}$/);

  const roomCode = new URL(page.url()).pathname.split("/").at(-1);
  assert.match(roomCode, /^[A-Z2-9]{4}$/);
  return { context, page, errors, networkSnapshots, roomCode, name };
}

async function joinRoom(browser, { roomCode, name }) {
  const context = await browser.newContext({ viewport: mobileViewport });
  const page = await context.newPage();
  const errors = watchConsole(page, `guest:${name}`);
  const networkSnapshots = watchSnapshots(page);

  await page.goto(`${baseUrl}/join?code=${roomCode}`);
  await page.getByLabel("Room code").fill(roomCode);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: /join room/i }).click();
  await page.waitForURL(new RegExp(`/game/${roomCode}$`));
  return { context, page, errors, networkSnapshots, name };
}

async function saveFailure(page, name) {
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
}

test("four concurrent players can complete Chameleon, recover the host, rematch, and close", async () => {
  const browser = await chromium.launch({ headless: true });
  const sessions = [];
  try {
    const host = await hostRoom(browser, { mode: "chameleon", name: "Chandra" });
    sessions.push(host);
    sessions.push(
      ...(await Promise.all(
        ["Bailey", "Cameron", "Drew"].map((name) =>
          joinRoom(browser, { roomCode: host.roomCode, name }),
        ),
      )),
    );

    await host.page.getByText("4/8", { exact: true }).waitFor();
    await host.page.getByRole("button", { name: /^start game$/i }).click();
    await Promise.all(sessions.map(({ page }) => waitForStatus(page, "role_reveal")));

    const roleSnapshots = await Promise.all(sessions.map(({ page }) => currentSnapshot(page)));
    const chameleonIndex = roleSnapshots.findIndex((snapshot, index) =>
      snapshot.players.some(
        (player) => player.display_name === sessions[index].name && player.is_outsider === true,
      ),
    );
    assert.notEqual(chameleonIndex, -1, "one browser context must receive the Chameleon role");
    const chameleon = sessions[chameleonIndex];
    const chameleonSnapshot = roleSnapshots[chameleonIndex];
    const playerSnapshot = roleSnapshots.find((_, index) => index !== chameleonIndex);
    assert.equal(chameleonSnapshot.word_text, null, "the Chameleon snapshot must not identify the selected word");
    assert.ok(playerSnapshot.word_text, "non-Chameleon players must receive the selected word");
    assert.equal(chameleonSnapshot.guess_word_options.length, playerSnapshot.guess_word_options.length);
    assert.ok(chameleonSnapshot.guess_word_options.length >= 4, "the category word card must be visible");

    for (const { page } of sessions) {
      await page.getByRole("button", { name: /i saw my role/i }).click();
    }
    const hintState = await waitForStatus(host.page, "hint_phase");
    for (const userId of hintState.round.hint_order) {
      const session = sessions.find(({ name }) =>
        hintState.players.some((player) => player.user_id === userId && player.display_name === name),
      );
      assert.ok(session, `missing browser context for clue turn ${userId}`);
      await waitForStatus(session.page, "hint_phase");
      await session.page.getByRole("button", { name: /i gave my clue/i }).click();
    }

    await Promise.all(sessions.map(({ page }) => waitForStatus(page, "voting")));
    const chameleonName = chameleon.name;
    const innocentSessions = sessions.filter((session) => session !== chameleon);
    const revisingVoter = innocentSessions[0];
    const firstChoice = innocentSessions.find((session) => session !== revisingVoter).name;
    await playerButton(revisingVoter.page, firstChoice).click();
    await revisingVoter.page.getByRole("button", { name: /^cast vote$/i }).click();
    await revisingVoter.page.getByText(new RegExp(`Current choice: ${firstChoice}`, "i")).waitFor();
    await playerButton(revisingVoter.page, chameleonName).click();
    await revisingVoter.page.getByRole("button", { name: /^change vote$/i }).click();
    await revisingVoter.page.getByText(new RegExp(`Current choice: ${chameleonName}`, "i")).waitFor();

    await playerButton(innocentSessions[1].page, chameleonName).click();
    await innocentSessions[1].page.getByRole("button", { name: /^cast vote$/i }).click();
    const tiedInnocent = innocentSessions[1];
    await playerButton(innocentSessions[2].page, tiedInnocent.name).click();
    await innocentSessions[2].page.getByRole("button", { name: /^cast vote$/i }).click();
    await playerButton(chameleon.page, tiedInnocent.name).click();
    await chameleon.page.getByRole("button", { name: /^cast vote$/i }).click();

    await Promise.all(sessions.map(({ page }) => waitForStatus(page, "chameleon_tie_break")));
    await playerButton(host.page, chameleonName).click();
    await host.page.getByRole("button", { name: /^break the tie$/i }).click();
    await Promise.all(sessions.map(({ page }) => waitForStatus(page, "chameleon_guess")));
    const guessingState = await currentSnapshot(chameleon.page);
    const wrongWord = guessingState.guess_word_options.find(
      (option) => option.text !== playerSnapshot.word_text,
    );
    assert.ok(wrongWord, "the category must contain a deliberate wrong guess");
    await chameleon.page.getByRole("radio", { name: wrongWord.text, exact: true }).click();
    await chameleon.page.getByRole("button", { name: /lock in final guess/i }).click();

    const results = await Promise.all(sessions.map(({ page }) => waitForStatus(page, "game_over")));
    assert.ok(results.every((snapshot) => snapshot.winner === "players"));
    assert.ok(
      chameleon.networkSnapshots
        .filter((snapshot) => snapshot.game?.status === "role_reveal")
        .every((snapshot) => snapshot.word_text === null),
      "browser-visible Chameleon responses must not reveal the selected word",
    );
    assert.deepEqual(sessions.flatMap((session) => session.errors), []);

    await host.page.close();
    const recoverer = sessions.find((session) => session !== host);
    const recover = recoverer.page.getByRole("button", { name: /^recover room controls$/i });
    await recover.waitFor({ timeout: 150_000 });
    await recover.click();
    await recoverer.page.getByRole("button", { name: /play again in this room/i }).waitFor();
    await recoverer.page.getByRole("button", { name: /play again in this room/i }).click();
    const activeSessions = sessions.filter((session) => session !== host);
    const rematches = await Promise.all(activeSessions.map(({ page }) => waitForStatus(page, "lobby")));
    assert.ok(rematches.every((snapshot) => snapshot.game.room_code === host.roomCode));
    assert.ok(rematches.every((snapshot) => snapshot.players.length === 4));

    await recoverer.page.getByRole("button", { name: /^close room$/i }).click();
    await recoverer.page.getByRole("button", { name: /yes, close room/i }).click();
    await recoverer.page.waitForURL(`${baseUrl}/`);
    await Promise.all(
      activeSessions.filter((session) => session !== recoverer).map(({ page }) =>
        page.getByText(/room not found|no longer exists/i).waitFor({ timeout: 10_000 }),
      ),
    );
  } catch (error) {
    const failurePage = sessions.find((session) => !session.page.isClosed())?.page;
    if (failurePage) await saveFailure(failurePage, "chameleon-complete-failure");
    throw error;
  } finally {
    await Promise.all(sessions.map((session) => session.context.close()));
    await browser.close();
  }
});

test("five players can complete Mafia with refresh, revised actions, spectator state, and rematch", async () => {
  const browser = await chromium.launch({ headless: true });
  const sessions = [];
  try {
    const host = await hostRoom(browser, { mode: "mafia", name: "Morgan" });
    sessions.push(host);
    for (const name of ["Avery", "Jordan", "Reese", "Skyler"]) {
      sessions.push(await joinRoom(browser, { roomCode: host.roomCode, name }));
    }

    await host.page.getByText("5/25", { exact: true }).waitFor();
    const racingPlayer = sessions.at(-1);
    await Promise.allSettled([
      host.page.getByRole("button", { name: /^start game$/i }).click(),
      racingPlayer.page.getByRole("button", { name: /^leave game$/i }).click(),
    ]);
    await host.page.waitForTimeout(1_000);
    const raceResult = await currentSnapshot(host.page);
    if (raceResult.game.status === "lobby") {
      if (raceResult.players.length === 4) {
        await racingPlayer.page.goto(`${baseUrl}/join?code=${host.roomCode}`);
        await racingPlayer.page.getByLabel("Room code").fill(host.roomCode);
        await racingPlayer.page.getByLabel("Your name").fill(racingPlayer.name);
        await racingPlayer.page.getByRole("button", { name: /join room/i }).click();
        await racingPlayer.page.waitForURL(new RegExp(`/game/${host.roomCode}$`));
        await host.page.getByText("5/25", { exact: true }).waitFor();
      }
      await host.page.getByRole("button", { name: /^start game$/i }).click();
    }
    // One side of the intentional start/leave race must lose with a handled
    // 4xx response. The UI reconciles the lobby before the actual game; zero
    // console errors are enforced from this point through room closure.
    sessions.forEach((session) => session.errors.splice(0));
    await Promise.all(sessions.map(({ page }) => waitForStatus(page, "role_reveal")));

    const roleSnapshots = await Promise.all(sessions.map(({ page }) => currentSnapshot(page)));
    sessions.forEach((session, index) => {
      session.role = roleSnapshots[index].players.find(
        (player) => player.display_name === session.name,
      )?.role;
    });
    assert.equal(sessions.filter((session) => session.role === "mafia").length, 1);
    assert.equal(sessions.filter((session) => session.role === "sheriff").length, 1);
    assert.equal(sessions.filter((session) => session.role === "angel").length, 1);
    assert.equal(sessions.filter((session) => session.role === "faithful").length, 2);
    const faithfulSnapshot = roleSnapshots[sessions.findIndex((session) => session.role === "faithful")];
    assert.ok(
      faithfulSnapshot.players.every(
        (player) => player.display_name === sessions.find((session) => session.role === "faithful").name || player.role === null,
      ),
      "a town browser response must not enumerate other private roles",
    );

    const reloadSession = sessions[1];
    await reloadSession.page.reload();
    const reloaded = await waitForStatus(reloadSession.page, "role_reveal");
    assert.equal(
      reloaded.players.find((player) => player.display_name === reloadSession.name)?.role,
      reloadSession.role,
    );

    for (const { page } of sessions) {
      await page.getByRole("button", { name: /i saw my role/i }).click();
    }
    await Promise.all(sessions.map(({ page }) => waitForStatus(page, "night")));

    const mafia = sessions.find((session) => session.role === "mafia");
    const sheriff = sessions.find((session) => session.role === "sheriff");
    const angel = sessions.find((session) => session.role === "angel");
    const victim = sessions.find((session) => session.role === "faithful" && session !== host);
    const firstTarget = sessions.find(
      (session) => session.role !== "mafia" && session !== victim,
    );
    assert.ok(mafia && sheriff && angel && victim && firstTarget);

    await playerButton(mafia.page, firstTarget.name).click();
    await mafia.page.getByRole("button", { name: /^confirm kill$/i }).click();
    await mafia.page.getByText(new RegExp(`Current choice: ${firstTarget.name}`, "i")).waitFor();
    await playerButton(mafia.page, victim.name).click();
    await mafia.page.getByRole("button", { name: /^change target$/i }).click();
    await mafia.page.getByText(new RegExp(`Current choice: ${victim.name}`, "i")).waitFor();

    await playerButton(sheriff.page, mafia.name).click();
    await sheriff.page.getByRole("button", { name: /^inspect player$/i }).click();
    await sheriff.page.getByText("Mafia", { exact: true }).waitFor();
    await playerButton(angel.page, firstTarget.name).click();
    await angel.page.getByRole("button", { name: /^protect player$/i }).click();

    await Promise.all(sessions.map(({ page }) => waitForStatus(page, "day_result")));
    await host.page.getByText(victim.name, { exact: true }).waitFor();
    for (const { page } of sessions) {
      await page.getByRole("button", { name: /i saw the morning result/i }).click();
    }

    await Promise.all(
      sessions
        .filter((session) => session !== victim)
        .map(({ page }) => waitForStatus(page, "day_vote")),
    );
    await victim.page.getByText(/watch the town decide who to vote out/i).waitFor();

    const livingTown = sessions.filter(
      (session) => session !== victim && session.role !== "mafia",
    );
    const revisingVoter = livingTown[0];
    const wrongVote = livingTown.find((session) => session !== revisingVoter) ?? revisingVoter;
    await playerButton(revisingVoter.page, wrongVote.name).click();
    await revisingVoter.page.getByRole("button", { name: /^cast vote$/i }).click();
    await revisingVoter.page.getByText(new RegExp(`Current choice: ${wrongVote.name}`, "i")).waitFor();
    await playerButton(revisingVoter.page, mafia.name).click();
    await revisingVoter.page.getByRole("button", { name: /^change vote$/i }).click();

    for (const session of livingTown.slice(1)) {
      await playerButton(session.page, mafia.name).click();
      await session.page.getByRole("button", { name: /^cast vote$/i }).click();
    }
    await playerButton(mafia.page, livingTown[0].name).click();
    await mafia.page.getByRole("button", { name: /^cast vote$/i }).click();

    const results = await Promise.all(sessions.map(({ page }) => waitForStatus(page, "game_over")));
    assert.ok(results.every((snapshot) => snapshot.winner === "town"));
    assert.deepEqual(sessions.flatMap((session) => session.errors), []);

    await host.page.getByRole("button", { name: /play again in this room/i }).click();
    const rematches = await Promise.all(sessions.map(({ page }) => waitForStatus(page, "lobby")));
    assert.ok(rematches.every((snapshot) => snapshot.players.length === 5));
    assert.ok(rematches.every((snapshot) => snapshot.game.room_code === host.roomCode));

    await host.page.getByRole("button", { name: /^close room$/i }).click();
    await host.page.getByRole("button", { name: /yes, close room/i }).click();
    await host.page.waitForURL(`${baseUrl}/`);
    await Promise.all(
      sessions.slice(1).map(({ page }) =>
        page.getByText(/room not found|no longer exists/i).waitFor({ timeout: 10_000 }),
      ),
    );
  } catch (error) {
    if (sessions[0]?.page) await saveFailure(sessions[0].page, "mafia-complete-failure");
    throw error;
  } finally {
    await Promise.all(sessions.map((session) => session.context.close()));
    await browser.close();
  }
});
