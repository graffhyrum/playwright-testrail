import {
  FullConfig,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import {TestCaseResult, TestRailPlugin} from './plugin';
import {FunctionQueue} from './util/FunctionQueue';
import {assertIsDefined} from './util/type_utils/assertions';

class TestRailReporter implements Reporter {
  suite: Suite | undefined;
  private functionQue: FunctionQueue = new FunctionQueue(90, 'min');
  private testRailPluginPromise: Promise<TestRailPlugin> | undefined;
  private testRailPlugin: TestRailPlugin | undefined;
  private testCases: TestCaseResult[] = [];

  async onBegin(config: FullConfig, suite: Suite) {
    this.suite = suite;
    this.testRailPluginPromise = TestRailPlugin.create();
  }

  async onTestEnd(test: TestCase, result: TestResult) {
    const testCase: TestCaseResult = {
      testCase: test,
      testResult: result,
    };
    const notSkippedOrInterrupted = !['skipped', 'interrupted'].includes(
      result.status
    );
    if (notSkippedOrInterrupted) {
      this.testCases.push(testCase);
    }
  }

  async onEnd() {
    const testRailPlugin = await this.testRailPluginPromise;
    assertIsDefined(testRailPlugin, 'testRailPlugin not defined');
    this.testRailPlugin = testRailPlugin;
    const allCaseIDs: number[] = [];
    // collect all tests for the run
    this.suite?.allTests().forEach(test => {
      const ids = testRailPlugin?.getAllCaseIdsFromTitle(test.title);
      if (!ids) {
        return;
      }
      allCaseIDs.push(...ids);
    });
    await testRailPlugin.updateRun(allCaseIDs);
    for (const testCase of this.testCases) {
      await testRailPlugin.processResults(testCase);
    }
  }

  async onExit() {
    if (this.functionQue.isRunning) {
      await this.functionQue.waitUntilQueueClear();
      await this.functionQue.stop();
    }
    assertIsDefined(this.testRailPlugin, 'testRailPlugin not defined');
    await this.testRailPlugin.teardown();
    await this.testRailPlugin.logTestedCases();
  }
}

export default TestRailReporter;
