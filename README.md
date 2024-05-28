# playwright-testrail

> A Playwright reporter for TestRail

[![npm](https://img.shields.io/npm/dm/playwright-testrail.svg)](https://www.npmjs.com/package/playwright-testrail) [![npm](https://img.shields.io/npm/v/playwright-testrail.svg)](https://www.npmjs.com/package/playwright-testrail)

## Installation

```bash
npm i -D playwright-testrail
```

or via yarn:

```bash
yarn add playwright-testrail --dev
```

## Usage

Add **playwright-testrail** into **playwright.config.ts**:

```js
{
  reporter: "playwright-testrail";
}
```

Or pass the same value via command line:

```bash
npx playwright test --reporter=playwright-testrail
```

---

## Environment Variables

These can be set either with the CLI or via a `.env` file.

- `TESTRAIL_HOST` - TestRail host EG: `https://yourcompany.testrail.io`
- `TESTRAIL_USERNAME` - TestRail username
- `TESTRAIL_API_KEY` - TestRail API key
- `TESTRAIL_PROJECT_ID` - TestRail project ID
- `TESTRAIL_RUN_ID` - Optional TestRail run ID, if not provided, a new run will be created, otherwise, the test results will be added to the existing run
