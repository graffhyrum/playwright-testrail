/**
 * Retries a callback until it returns a truthy value or the timeout is reached.
 * @param callback
 * @param timeout
 * @param options
 */
export async function retryCallback<T, R>(
  callback: (...args: T[]) => R,
  timeout: number,
  options?: {
    delay?: number;
    desiredResultTestFunction?: (
      result: R,
      ...args: never[]
    ) => boolean | Promise<boolean>;
    maxRetries?: number;
  }
): Promise<R | undefined> {
  const startTime = Date.now();
  let retries = 0;
  let timeExceeded, maxRetriesExceeded;
  do {
    const result = await callback();
    if (
      options?.desiredResultTestFunction
        ? await options.desiredResultTestFunction(result as R)
        : result
    ) {
      return result;
    }
    if (options?.delay) {
      await new Promise(resolve => setTimeout(resolve, options.delay));
    }
    retries++;
    timeExceeded = Date.now() - startTime > timeout;
    maxRetriesExceeded =
      options?.maxRetries !== undefined && retries >= options.maxRetries;
  } while (!timeExceeded && !maxRetriesExceeded);

  return undefined;
}
