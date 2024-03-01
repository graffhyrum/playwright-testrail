import test, {expect} from '@playwright/test';

test('C1 - sanity', async () => {
  expect(true).toBeTruthy();
});

// C2 - C9
for (let i = 2; i < 10; i++) {
  test(`C${i} - test ${i} pass if even`, async () => {
    expect(i % 2 === 0).toBeTruthy();
  });
}

test('C10 - test 10 flaky', async ({}, testInfo) => {
  expect(testInfo.retry).toEqual(1); // simulated flake
});
