import TestRail from '@dlenroc/testrail';
import {
  assertIsDefined,
  assertIsNumber,
  assertString,
} from './util/type_utils/assertions';
import {PROJECTS} from '../playwright.config';

export const testrailBuilder = () => {
  const maybeProjectId = Number(process.env.TESTRAIL_PROJECT_ID);
  assertIsNumber(maybeProjectId);
  const projectId = maybeProjectId;
  const projects = PROJECTS;
  const date = new Date();
  const runLabel = `${
    process.env.TESTRAIL_RUN_BASE_NAME ??
    `Automated Test Run for ${projects[2]?.name}`
  } - ${date.toDateString()}`;
  const initializeClient = async () => {
    const client = getClient();
    await testClient(client);
    return client;

    function getClient() {
      const testRailUser = process.env.TESTRAIL_USERNAME;
      const testRailSecret =
        process.env.TESTRAIL_PASSWORD || process.env.TESTRAIL_API_KEY || '';
      const host = process.env.TESTRAIL_HOST;
      assertString(testRailUser);
      assertString(testRailSecret);
      assertString(host);
      return new TestRail({
        host,
        username: testRailUser,
        password: testRailSecret,
      });
    }

    async function testClient(client: TestRail) {
      try {
        const user = await client.getCurrentUser();
        console.log(`TestRail user: ${user.name} (${user.email})`);
      } catch (err) {
        throw new Error(`TestRail authentication failed: ${err}`);
      }
    }
  };
  const initializeRun = async (client: TestRail) => {
    let runId = process.env.TESTRAIL_RUN_ID
      ? Number(process.env.TESTRAIL_RUN_ID)
      : undefined;
    let thisRun: TestRail.Run | undefined;
    if (!runId) {
      console.log(JSON.stringify(client, null, 2));
      thisRun = await buildRun(client);
    } else {
      thisRun = await client.getRun(runId);
    }
    assertIsDefined(thisRun, 'TestRail run is undefined.');
    runId = thisRun.id;
    assertIsDefined(runId, 'TestRail run id is undefined.');
    console.log(
      `TestRail run: ${thisRun.name} (${thisRun.id})\n ${thisRun.url}`
    );
    return thisRun;
  };
  const buildRun = async (client: TestRail) => {
    const user = await client.getCurrentUser();
    assertString(runLabel);
    const description = `UTC timestamp: ${date.toUTCString()}\nTester timestamp: ${date.toTimeString()}`;
    assertString(description);
    const payload = {
      name: runLabel,
      description,
      include_all: false,
      assignedto_id: user.id,
    };
    return client.addRun(projectId, payload);
  };

  return {
    initializeClient,
    initializeRun,
  };
};
