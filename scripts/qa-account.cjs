const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const target = process.argv[2] || 'http://127.0.0.1:4174';
const liveOnly = process.argv.includes('--live');
const report = { consoleErrors: [], cases: [] };

const authConfig = { available: true, method: 'password', passwordMinLength: 8 };
const savedProgress = {
  currentLevel: 1,
  levels: {},
  currency: 83,
  dailyGameRewards: { date: '2026-08-15', earned: { match3: 0, game2048: 0, bubbles: 0, pet: 0 } },
  lives: 5,
  nextLifeAt: null,
  selectedCharacter: 'yaromir',
  tutorialCompleted: false,
  tutorialFlags: [],
  best2048Score: 0,
  bubbleLevelsCompleted: 0,
  pet: null,
  petDeparture: null,
  unlockedCharacters: ['yaromir'],
  inventory: {},
  rewardClaims: [],
  cart: [],
  orders: [],
};

function watchConsole(page) {
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('status of 401')) report.consoleErrors.push(message.text());
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    if (liveOnly) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      watchConsole(page);
      await page.goto(`${target}/account`, { waitUntil: 'networkidle' });
      assert.equal(await page.getByRole('heading', { name: 'С возвращением' }).isVisible(), true);
      assert.equal(await page.getByLabel('Телефон').isVisible(), true);
      assert.equal(await page.getByLabel('Пароль', { exact: true }).isVisible(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
      report.cases.push({ name: 'Live phone/password form on iPhone viewport', status: 'passed' });
      await context.close();
    } else {
      const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const mobilePage = await mobileContext.newPage();
      watchConsole(mobilePage);
      await mobilePage.route('**/api/auth/config', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authConfig) }));
      await mobilePage.route('**/api/auth/me', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Войдите в профиль.' }) }));
      let registerBody = null;
      await mobilePage.route('**/api/auth/register', async route => {
        registerBody = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            account: { id: 'qa-user', name: 'Юлия', city: 'Зеленогорск', phoneMasked: '+7 ••• •••-12-34', createdAt: Date.now(), lastLoginAt: Date.now() },
            progress: savedProgress,
            revision: 1,
          }),
        });
      });

      await mobilePage.goto(`${target}/account`, { waitUntil: 'networkidle' });
      assert.equal(await mobilePage.getByRole('group', { name: 'Вход или регистрация' }).getByRole('button', { name: 'Войти' }).isVisible(), true);
      await mobilePage.getByRole('button', { name: 'Регистрация' }).click();
      await mobilePage.getByLabel('Имя').fill('Юлия');
      await mobilePage.getByLabel('Телефон').fill('9000001234');
      await mobilePage.getByLabel('Пароль', { exact: true }).fill('synthetic-password');
      await mobilePage.getByLabel('Повторите пароль').fill('synthetic-password');
      await mobilePage.getByRole('button', { name: 'Зеленогорск' }).click();
      await mobilePage.getByRole('checkbox').check();
      await mobilePage.getByRole('button', { name: 'Создать профиль' }).click();
      await mobilePage.waitForURL('**/profile');
      assert.equal(registerBody.phone, '9000001234');
      assert.equal(registerBody.password, 'synthetic-password');
      assert.equal(registerBody.city, 'Зеленогорск');
      assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
      report.cases.push({ name: 'iPhone password registration', status: 'passed' });
      await mobilePage.screenshot({ path: path.join(os.tmpdir(), 'termburg-auth-mobile.png'), fullPage: true });
      await mobileContext.close();

      const profileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const profilePage = await profileContext.newPage();
      watchConsole(profilePage);
      await profilePage.route('**/api/auth/config', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authConfig) }));
      await profilePage.route('**/api/auth/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ account: { id: 'qa-user', name: 'Владимир Сиваев', city: 'Москва', phoneMasked: '+7 ••• •••-12-34', createdAt: Date.now(), lastLoginAt: Date.now() }, progress: savedProgress, revision: 4 }) }));
      await profilePage.route('**/api/auth/logout', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
      await profilePage.goto(`${target}/profile`, { waitUntil: 'networkidle' });
      assert.equal(await profilePage.getByRole('heading', { name: 'Владимир Сиваев' }).isVisible(), true);
      assert.equal(await profilePage.getByText('+7 ••• •••-12-34').isVisible(), true);
      assert.equal(await profilePage.getByText('Ваш термлин').isVisible(), true);
      assert.equal(await profilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
      await profilePage.screenshot({ path: path.join(os.tmpdir(), 'termburg-profile-mobile.png'), fullPage: false });
      profilePage.once('dialog', dialog => dialog.accept());
      await profilePage.getByRole('button', { name: 'Выйти из профиля' }).click();
      await profilePage.getByRole('heading', { name: 'Гостевая игра' }).waitFor();
      report.cases.push({ name: 'Authenticated profile and logout', status: 'passed' });
      await profileContext.close();

      const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const desktopPage = await desktopContext.newPage();
      watchConsole(desktopPage);
      await desktopPage.route('**/api/auth/config', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authConfig) }));
      await desktopPage.route('**/api/auth/me', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Войдите в профиль.' }) }));
      await desktopPage.goto(`${target}/account`, { waitUntil: 'networkidle' });
      assert.equal(await desktopPage.getByRole('heading', { name: 'С возвращением' }).isVisible(), true);
      assert.equal(await desktopPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
      report.cases.push({ name: 'Desktop password login form', status: 'passed' });
      await desktopPage.screenshot({ path: path.join(os.tmpdir(), 'termburg-auth-desktop.png'), fullPage: true });
      await desktopContext.close();
    }

    assert.deepEqual(report.consoleErrors, []);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
