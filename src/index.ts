import {Reporter, TestCase, TestResult} from '@playwright/test/reporter';
import {TestCaseResult, TestRailPlugin} from './plugin';

/**
 * TestRailReporter is a Playwright test reporter that uploads test results to TestRail.
 * It requires
 */
export default class TestRailReporter implements Reporter {
  private results: TestCaseResult[] = [];
  private caseIDs: number[] = [];

  async onTestEnd(test: TestCase, result: TestResult) {
    const testCase: TestCaseResult = {
      testCase: test,
      testResult: result,
    };

    const ids = TestRailPlugin.getAllCaseIdsFromAnnotations(test.annotations);
    this.caseIDs.push(...ids);
    this.results.push(testCase);
  }

  async onEnd() {
    if (this.caseIDs.length > 0) {
      const clientInstance = await TestRailPlugin.create();
      await clientInstance.updateRun(this.caseIDs);
      await clientInstance.uploadAllResults(this.results);
      await clientInstance.teardown();
    }
  }
}
