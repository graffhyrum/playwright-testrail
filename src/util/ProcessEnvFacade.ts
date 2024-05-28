import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * ProcessEnvFacade is an object that provides methods to interact with environment variables.
 * It provides methods to get, set, and validate environment variables.
 */
const ProcessEnvFacade = {
  /**
   * getValueOrThrow method retrieves the value of the given environment variable.
   * If the environment variable is not set, it throws an error.
   * @param {keyof NodeJS.ProcessEnv} key - The name of the environment variable.
   * @returns {string} The value of the environment variable.
   * @throws {Error} If the environment variable is not set.
   */
  getValueOrThrow: (key: keyof NodeJS.ProcessEnv): string => {
    const maybeKey = process.env[key];
    if (!maybeKey) {
      throw new Error(`Environment variable ${key} is not set`);
    }
    return maybeKey;
  },

  /**
   * getValue method retrieves the value of the given environment variable.
   * @param {keyof NodeJS.ProcessEnv} key - The name of the environment variable.
   * @returns {string | undefined} The value of the environment variable.
   */
  getValue: (key: keyof NodeJS.ProcessEnv): string | undefined =>
    process.env[key],

  /**
   * setValue method sets the value of the given environment variable.
   * The key must be defined in the global NodeJS.ProcessEnv interface (the environment.d.ts file).
   * @param {keyof NodeJS.ProcessEnv} key - The name of the environment variable.
   * @param {string} value - The value to set for the environment variable.
   */
  setValue: (key: keyof NodeJS.ProcessEnv, value: string) => {
    process.env[key] = value;
  },
};

export default ProcessEnvFacade;
