import {
  Reporter,
  Suite,
  FullConfig,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

declare class TestRailReporter implements Reporter {
  suite: Suite | undefined;
  private functionQue;
  private testRailPluginPromise;
  private testRailPlugin;
  private testCases;
  onBegin(config: FullConfig, suite: Suite): Promise<void>;
  onTestEnd(test: TestCase, result: TestResult): Promise<void>;
  onEnd(): Promise<void>;
  onExit(): Promise<void>;
}

export {TestRailReporter as default};
