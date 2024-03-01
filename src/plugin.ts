import TestRail, {
  AddResultForCase,
  AddResultsForCases,
} from '@dlenroc/testrail';
import {TestCase, TestResult} from '@playwright/test/reporter';
import {testrailBuilder} from './builder';
import {retryCallback} from './util/retry';

export class TestRailPlugin {
  private client: TestRail;
  private runInstance: TestRail.Run;
  private allCases: number[] = [];
  private results: AddResultsForCases = {results: []};

  private constructor(
    client: TestRail,
    runInstance: TestRail.Run,
    allCases: number[]
  ) {
    this.client = client;
    this.runInstance = runInstance;
    this.allCases = allCases;
  }

  static async create() {
    const builder = testrailBuilder();
    const client = await builder.initializeClient();
    const runInstance = await builder.initializeRun(client);
    const cases = (await this.getAllCasesInRun(client, runInstance.id)) ?? [];
    return new TestRailPlugin(client, runInstance, cases);
  }

  //region run

  private static async getAllCasesInRun(
    client: TestRail,
    runId: number
  ): Promise<number[]> {
    const tests = await client.getTests(runId);
    return tests.map(result => result.case_id) ?? [];
  }

  /**
   * Adds the provided case ids to the run, and removes any invalid case ids
   * @param caseIds
   */
  async updateRun(caseIds: number[]) {
    let badCases: number[] = [];
    this.allCases.push(...caseIds);
    const payload = {
      case_ids: this.allCases,
    };
    try {
      await this.client.updateRun(this.runInstance.id, payload);
    } catch (error) {
      console.log(`--Error updating run ${this.runInstance.id}--\n\n`, error);
      // TR does not tell you which case(s) is not valid,
      // recurse with a tree to find the bad case(s),
      badCases = await this.findInvalidCases(this.allCases);
      console.log(badCases, `--${badCases.length} invalid cases found--\n`);
      // then remove them,
      this.allCases = this.allCases.filter(id => !badCases.includes(id));
      // then try to update the run again
      await this.updateRun(this.allCases);
    }
  }

  //endregion

  async closeRun(runId: number) {
    return await this.client.closeRun(runId);
  }

  //region results

  async processResults(testCase: TestCaseResult) {
    const title = testCase.testCase.title;
    const ids = this.getAllCaseIdsFromTitle(title);
    const results = this.parseResults(ids, testCase);
    if (results.results) {
      this.results.results?.push(...results.results);
    }
  }

  async teardown() {
    await this.addResults(this.results);
    if (process.env.CI === 'true') {
      await this.closeRun(this.runInstance.id);
    }
    console.log(`All tests complete. Run: ${this.runInstance.url} updated.`);
  }

  getAllCaseIdsFromTitle(title: string) {
    const idArr = [];
    const caseIDRegex = /C(\d+)/g;
    const caseIds = title
      .match(caseIDRegex)
      ?.map(str => Number(str.substring(1)));
    if (caseIds) {
      idArr.push(...caseIds);
    }
    return idArr;
  }

  async logTestedCases() {
    const cases: (number | undefined)[] = [];
    this.results.results?.forEach(result => {
      cases.push(result.case_id);
    });
    console.log(cases);
  }

  //endregion

  private async addResults(
    results: AddResultsForCases
  ): Promise<TestRail.Result[] | undefined> {
    try {
      return await retryCallback(
        async () => {
          try {
            return await this.client.addResultsForCases(
              this.runInstance.id,
              results
            );
          } catch (error) {
            return undefined;
          }
        },
        5000,
        {delay: 1000}
      );
    } catch (error) {
      throw new Error(`TestRail addResultsForCases failed: ${error}`);
    }
  }

  private parseResults(
    ids: number[],
    testCaseResult: TestCaseResult
  ): AddResultsForCases {
    return {
      results: ids.map(thisCaseId => {
        return this.generateResult(testCaseResult, thisCaseId);
      }),
    };
  }

  //endregion

  //region util

  private generateResult(
    testCaseResult: TestCaseResult,
    thisCaseId: number
  ): AddResultForCase {
    const errors = testCaseResult.testResult.errors;
    const errorStr = this.removeAnsiCodes(JSON.stringify(errors));
    return {
      case_id: thisCaseId,
      status_id: this.getStatusId(testCaseResult),
      comment: this.generateComment(testCaseResult, errorStr),
    };
  }

  //region attachments

  private generateComment(test: TestCaseResult, errorStr: string) {
    const errorMessage =
      `Errors----\n ${errorStr.replace(/\\n/g, '\n')}\n` +
      `stderr----\n ${test.testResult.stderr}\n` +
      `stdout----\n${test.testResult.stdout}\n` +
      `Retry# ${test.testResult.retry}`;
    const passedMessage = 'Automated test passed.';
    let outcomeMessage: string;
    if (test.testResult.error) {
      outcomeMessage = errorMessage;
    } else {
      outcomeMessage = passedMessage;
    }
    // return `Env: ${currentEnv}\n${outcomeMessage}`;
    return outcomeMessage;
  }

  private removeAnsiCodes(str: string) {
    const ansiEscapeCodes = /\\u001b\[.*?m/g;
    return str.replace(ansiEscapeCodes, '');
  }

  private getStatusId(test: TestCaseResult): number {
    const expectedResult = test.testCase.expectedStatus;
    const actualResult = test.testResult.status;

    switch (actualResult) {
      case 'passed':
        if (expectedResult === 'passed') {
          return getCode('passed');
        } else {
          return getCode('retest');
        }
      case 'failed':
        if (expectedResult === 'failed') {
          return getCode('failed');
        } else {
          return getCode('retest');
        }
      case 'timedOut':
        return getCode('retest');
      case 'skipped':
        return getCode('skipped');
      case 'interrupted':
        return getCode('retest');
    }

    function getCode(status: StatusName): number {
      // TestRail status codes
      // 1:passed, 2:blocked, 3:untested, 4:retest, 5:failed, 6:skipped
      switch (status) {
        case 'passed':
          return 1;
        case 'blocked':
          return 2;
        case 'untested':
          return 3;
        case 'retest':
          return 4;
        case 'failed':
          return 5;
        case 'skipped':
          return 6;
      }
    }
  }

  //endregion
  private async findInvalidCases(caseIds: number[]) {
    const n = caseIds.length;

    //base case
    if (n === 0) {
      return [];
    }
    if (n === 1) {
      return (await this.checkCaseValidity(caseIds)) ? [] : caseIds;
    }

    //recursive case
    const mid = Math.floor(n / 2);
    const left = caseIds.slice(0, mid);
    const right = caseIds.slice(mid);

    const [isValidLeft, isValidRight] = await Promise.all([
      this.checkCaseValidity(left),
      this.checkCaseValidity(right),
    ]);

    const invalidSubset: number[] = [];
    if (!isValidLeft || !isValidRight) {
      const invalidL = !isValidLeft ? await this.findInvalidCases(left) : [];
      const invalidR = !isValidRight ? await this.findInvalidCases(right) : [];
      invalidSubset.push(...invalidL, ...invalidR);
    }

    return invalidSubset;
  }

  private async checkCaseValidity(caseIds: number[]) {
    let resp = true;
    const payload = {
      case_ids: caseIds,
    };
    try {
      await this.client.updateRun(this.runInstance.id, payload);
    } catch (error) {
      resp = false;
    }
    return resp;
  }

  //endregion
}

//region interfaces
export interface TestCaseResult {
  testCase: TestCase;
  testResult: TestResult;
}

type StatusName =
  | 'passed'
  | 'blocked'
  | 'untested'
  | 'retest'
  | 'failed'
  | 'skipped';

//endregion
