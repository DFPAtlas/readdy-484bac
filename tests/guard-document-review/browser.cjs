const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    for (const [name, width, height] of [['mobile', 375, 640], ['desktop', 1280, 900]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(process.env.PHASE3D_FIXTURE_URL);
      await page.getByText('Could not load document review.', { exact: false }).waitFor();
      await page.getByRole('button', { name: 'Refresh status' }).click();
      await page.getByText('Submission awaiting capture', { exact: false }).waitFor();
      await page.getByRole('button', { name: 'Prepare or retry document review' }).click();
      await page.getByText('Synthetic queue unavailable').waitFor();
      assert.equal(await page.getByRole('button', { name: 'Open driving licence front' }).isDisabled(), true);
      await page.getByRole('button', { name: 'Prepare or retry document review' }).click();
      await page.getByText('Submission 42 · pending', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Record human review' }).isDisabled(), true);
      await page.getByRole('button', { name: 'Open driving licence front' }).click();
      const image = page.getByRole('img', { name: 'Driving licence front' });
      await image.waitFor();
      await page.waitForFunction(() => document.querySelector('img[alt="Driving licence front"]').naturalWidth > 0);
      await page.getByRole('button', { name: 'Open driving licence back' }).click();
      await page.getByRole('img', { name: 'Driving licence back' }).waitFor();
      await page.getByRole('button', { name: 'Open proof of address' }).click();
      await page.getByRole('link', { name: 'Download PDF for review' }).waitFor();
      const preview = page.getByLabel('Proof of address', { exact: true }).filter({ has: page.locator('iframe') });
      await preview.focus();
      assert.equal(await preview.evaluate((node) => node === document.activeElement), true);
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Record human review' }).click();
      await page.getByText('Human review recorded for submission 42.').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (name === 'mobile') {
        await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
        assert.ok(await page.evaluate(() => scrollY > 0));
      }
      if (process.env.PHASE3D_SCREENSHOTS) {
        await page.screenshot({ path: process.env.PHASE3D_SCREENSHOTS + '/phase-3d-review-' + name + '.png', fullPage: true });
      }
      await page.close();
      console.log('PASS', name, 'loading recovery, version, image and PDF access, keyboard focus, layout and attestation');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
