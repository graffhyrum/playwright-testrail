import {expect, test as setup} from '@playwright/test';

setup('is a before setup', async () => {
  expect(true).toBeTruthy();
});
