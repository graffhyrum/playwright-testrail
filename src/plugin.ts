import TestRail, {AddResultForCase} from '@dlenroc/testrail';
import fs, {ReadStream} from 'fs';
import {TestCase, TestResult} from '@playwright/test/reporter';
import {testrailBuilder} from './builder';
import ProcessEnvFacade from './util/ProcessEnvFacade';

export class TestRailPlugin {
  private client: TestRail;
  private runInstance: TestRail.Run;
  private allCases: number[] = [];

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
    const client = builder.initializeClient();
    const runInstance = await builder.initializeRun(client);
    const cases = (await this.getAllCasesInRun(client, runInstance.id)) ?? [];
    return new TestRailPlugin(client, runInstance, cases);
  }

  //region run

  static getAllCaseIdsFromAnnotations(
    annotations: Array<{type: string; description?: string}>
  ) {
    // TestRail annotations will have type: 'test_id' and the ID in the description
    const idArr: number[] = [];
    annotations.forEach(annotation => {
      if (annotation.type === 'test_id') {
        // TestRail case IDs are prefixed with 'C', so we need to remove it
        const caseId = Number(annotation.description?.substring(1));
        if (!isNaN(caseId)) {
          idArr.push(caseId);
        }
      }
    });
    return idArr;
  }

  private static async getAllCasesInRun(
    client: TestRail,
    runId: number
  ): Promise<number[]> {
    const tests = await client.getTests(runId);
    return tests.map(result => result.case_id) ?? [];
  }

  //endregion

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

  async closeRun(runId: number) {
    return await this.client.closeRun(runId);
  }

  //region results
  async uploadAllResults(results: TestCaseResult[]) {
    /*
    case_id?: number;
    status_id?: number;
    comment?: string;
    version?: string;
    elapsed?: string;
    defects?: string;
    assignedto_id?: number;
     */
    const payload: AddResultForCase[] = [];
    const attachmentIds: number[] = [];
    for (const result of results) {
      // keep a list of tests to attempt attachment upload
      const shouldUploadAttachments = result.testResult.status !== 'passed';
      const ids = TestRailPlugin.getAllCaseIdsFromAnnotations(
        result.testCase.annotations
      );
      if (shouldUploadAttachments) {
        attachmentIds.push(...ids);
      }
      for (const parseResult of this.parseResults(ids, result)) {
        payload.push(parseResult);
      }
    }

    const addResultRes = await this.client.addResultsForCases(
      this.runInstance.id,
      {
        results: payload,
      }
    );

    if (addResultRes) {
      for (const attachmentId of attachmentIds) {
        const attachment = results.find(result =>
          TestRailPlugin.getAllCaseIdsFromAnnotations(
            result.testCase.annotations
          ).includes(attachmentId)
        )?.testResult.attachments;
        if (attachment) {
          await Promise.all(
            attachment.map(async attach => {
              const fileStream = await this.getFileStream(attach);
              if (!fileStream) return;
              await this.tryUploadAttachment(
                addResultRes.find(res => res.case_id === attachmentId)!,
                fileStream
              );
            })
          );
        }
      }
    }
  }

  async teardown() {
    if (ProcessEnvFacade.getValue('CI') === 'true') {
      await this.closeRun(this.runInstance.id);
    }
    console.log(`All tests complete. Run: ${this.runInstance.url} updated.`);
  }

  //endregion

  private parseResults(
    ids: number[],
    testCaseResult: TestCaseResult
  ): AddResultForCase[] {
    return ids.map(thisCaseId => {
      return this.generateResult(thisCaseId, testCaseResult);
    });
  }

  private generateResult(thisCaseId: number, testCaseResult: TestCaseResult) {
    const errors = testCaseResult.testResult.errors;
    const errorStr = this.removeAnsiCodes(JSON.stringify(errors));
    return {
      case_id: thisCaseId,
      status_id: this.getStatusId(testCaseResult),
      comment: this.generateComment(testCaseResult, errorStr),
    };
  }

  //region attachments
  private async getFileStream(attachment: Attachment) {
    const path = attachment.path;
    if (path && fs.existsSync(path)) {
      return fs.createReadStream(path);
    } else {
      console.error(
        `Attachment at ${path ?? '_path missing_'} does not exist.`
      );
      return undefined;
    }
  }

  private async tryUploadAttachment(
    result: TestRail.Result,
    fileStream: ReadStream
  ) {
    let attemptsLeft = 2;
    let done = false;
    do {
      try {
        await this.client.addAttachmentToResult(result.id, fileStream);
        done = true;
      } catch (e) {
        attemptsLeft--;
        if (attemptsLeft <= 0) {
          console.error(
            `Failed to upload attachment ${fileStream.path} to TestRail.\nCase: ${result.location}`,
            e
          );
        } else {
          console.warn(
            `Failed to upload attachment ${fileStream.path} to TestRail. Retrying...`
          );
        }
      }
    } while (!done && attemptsLeft > 0);
  }

  private generateComment(test: TestCaseResult, errorStr: string) {
    const currentEnv = test.testCase.titlePath()[1]; //0th element in the title is the env context
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
    return `Env: ${currentEnv}\n${outcomeMessage}`;
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

/**
 * TestRail does not have their own alias for this
 */
type Attachment = {
  name: string;
  contentType: string;
  path?: string;
  body?: Buffer;
};
//endregion
