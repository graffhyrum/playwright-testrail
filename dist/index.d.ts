import { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

/**
 * TestRailReporter is a Playwright test reporter that uploads test results to TestRail.
 * It requires
 */
declare class TestRailReporter implements Reporter {
    private results;
    private caseIDs;
    onTestEnd(test: TestCase, result: TestResult): Promise<void>;
    onEnd(): Promise<void>;
}

export { TestRailReporter as default };
