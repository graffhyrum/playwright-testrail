import {defineConfig, devices} from '@playwright/test';
import {getProjects} from './src/util/config/getProjects';
import dotenv from 'dotenv';

dotenv.config();

export const PROJECTS = getProjects([
  {
    name: 'project',
    testDir: './tests',
    testMatch: '**/*.spec.ts',
    retries: 1,
  },
]);
if (PROJECTS.length === 0)
  throw new Error(
    '\n\n--No projects in this run, check environment variables--\n\n'
  );

export default defineConfig({
  testDir: './tests',
  retries: process.env.CI ? 2 : 2,
  reporter: [['html', {open: 'never'}], ['list'], ['./src/index.ts']],
  use: {
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
  projects: PROJECTS,
});
