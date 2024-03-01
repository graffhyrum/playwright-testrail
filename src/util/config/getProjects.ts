import {
  PlaywrightTestOptions,
  PlaywrightWorkerOptions,
  Project,
} from '@playwright/test';

type ConfigProject = Project<PlaywrightTestOptions, PlaywrightWorkerOptions>;

export const SETUP_PROJECT_NAME = '__setup__';
export const TEARDOWN_PROJECT_NAME = '__teardown__';

const setupGlob = '**/setup.ts';
const teardownGlob = '**/teardown.ts';

export function getProjects(
  testProjects: ConfigProjectForCreate[]
): ConfigProject[] {
  const projArr: ConfigProject[] = [
    {
      name: SETUP_PROJECT_NAME,
      testMatch: setupGlob,
      teardown: TEARDOWN_PROJECT_NAME,
    },
    {
      name: TEARDOWN_PROJECT_NAME,
      testMatch: teardownGlob,
      timeout: 0,
      use: {
        actionTimeout: 0,
      },
    },
  ];
  const items = getItems();
  projArr.push(...items);

  return projArr;

  function getItems(): ConfigProject[] {
    return testProjects.map(y => {
      return {
        ...y,
        dependencies: [SETUP_PROJECT_NAME],
      };
    });
  }
}

export type ConfigProjectForCreate = Omit<ConfigProject, 'dependencies'>;
