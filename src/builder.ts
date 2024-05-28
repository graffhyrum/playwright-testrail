import TestRail from '@dlenroc/testrail';
import ProcessEnvFacade from './util/ProcessEnvFacade';
import {assertIsDefined, assertString} from './util/type_utils/assertions';

export const testrailBuilder = () => {
  const initializeClient = () => {
    const client = getClient();
    testClient(client);
    return client;
  };

  const initializeRun = async (client: TestRail) => {
    let runId = ProcessEnvFacade.getValue('TESTRAIL_RUN_ID')
      ? Number(ProcessEnvFacade.getValue('TESTRAIL_RUN_ID'))
      : undefined;
    const thisRun = runId ? await client.getRun(runId) : await buildRun(client);
    assertIsDefined(thisRun, 'TestRail run is undefined.');
    runId = thisRun.id;
    assertIsDefined(runId, 'TestRail run id is undefined.');
    console.log(
      `TestRail run: ${thisRun.name} (${thisRun.id})\n ${thisRun.url}`
    );
    return thisRun;
  };

  return {
    initializeClient,
    initializeRun,
  };
};

function getClient() {
  const testRailUser = ProcessEnvFacade.getValueOrThrow('TESTRAIL_USERNAME');
  const testRailPassword =
    ProcessEnvFacade.getValueOrThrow('TESTRAIL_PASSWORD');
  const host = ProcessEnvFacade.getValueOrThrow('TESTRAIL_HOST');
  return new TestRail({
    host,
    username: testRailUser,
    password: testRailPassword,
  });
}

function testClient(client: TestRail) {
  client
    .getCurrentUser()
    .then(user => {
      console.log(`TestRail user: ${user.name} (${user.email})`);
    })
    .catch(err => {
      throw new Error(`TestRail authentication failed: ${err}`);
    });
}

async function buildRun(client: TestRail) {
  const date = new Date();
  const runName = `${
    ProcessEnvFacade.getValue('TESTRAIL_RUN_BASE_NAME') ??
    'Playwright Automated Test Run - '
  } - ${date.toDateString()}`;

  const user = await client.getCurrentUser();
  assertString(runName);
  const description = `UTC timestamp: ${date.toUTCString()}\nTester timestamp: ${date.toTimeString()}`;
  assertString(description);
  const payload = {
    name: runName,
    description,
    include_all: false,
    assignedto_id: user.id,
  };

  const projectId = Number(
    ProcessEnvFacade.getValueOrThrow('TESTRAIL_PROJECT_ID')
  );
  return client.addRun(projectId, payload);
}
