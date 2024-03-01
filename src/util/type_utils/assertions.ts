export function assertIsArrayType<T extends object>(
  x: unknown,
  expectedKeys: (keyof T)[]
): asserts x is T[] {
  assertIsArray(x);
  const passes = (x as T[]).every(thisX => {
    return isType<T>(thisX, expectedKeys);
  });
  if (!passes) {
    const maybeTypeString = JSON.stringify(x, null, 2);
    throw new Error(
      `Symbol ${maybeTypeString} failed type assertion, aborting...`
    );
  }
}

/**
 * Generic type assertion function, use to implement specific type assertions by
 * making sure the checked symbol has each of the keys specified in `expectedKeys`.
 *
 * @param maybeType The thing to be checked
 * @param expectedKeys An array of keys to check for to verify the type
 *
 * @example
 * type Person = {
 *   name:string,
 *   address:string,
 *   job:string
 * }
 *
 * const steve: Person | unknown = {
 *   name:"steve",
 *   address:"123 Easy St.",
 *   job: "plumber"
 * }
 *
 * const fido = {
 *   name:"fido",
 *   address:"123 Easy St.",
 * }
 *
 * // GOOD
 * assertIsType<Person>(steve,["name","job"]) // steve narrowed to Person
 * assertIsType<Person>(fido,["name","job"]) // throws, 'job' missing from fido
 *
 * // WRONG
 * assertIsType(steve,["name","job"]) // type argument missing
 * assertIsType<Person>(steve,["nam","job"]) // error, misspelled keys
 */
export function assertIsType<T extends object>(
  maybeType: unknown,
  expectedKeys: readonly (keyof T)[]
): asserts maybeType is T {
  const passes = isType<T>(maybeType, expectedKeys);
  if (!passes) {
    const maybeTypeString = JSON.stringify(maybeType, null, 2);
    throw new Error(
      `Symbol ${maybeTypeString} failed type assertion, aborting...`
    );
  }
}

/**
 * Generic type narrowing function, use to implement specific type assertions by
 * making sure the checked symbol has each of the keys specified in `expectedKeys`.
 *
 * @param maybeType The thing to be checked
 * @param expectedKeys An array of keys to check for to verify the type
 *
 * @example
 * type Person = {
 *   name:string,
 *   address:string,
 *   job:string
 * }
 *
 * const steve: Person | unknown = {
 *   name:"steve",
 *   address:"123 Easy St.",
 *   job: "plumber"
 * }
 *
 * const fido = {
 *   name:"fido",
 *   address:"123 Easy St.",
 * }
 *
 * // GOOD
 * const isSteveAPerson = isType<Person>(steve,["name","job"]) // true
 * const isFidoAPerson = isType<Person>(fido,["name","job"]) // false, no job
 *
 * // WRONG
 * const isSteveAPerson = isType(steve,["name","job"]) // type argument missing
 * const isSteveAPerson = isType<Person>(steve,["nam","job"]) // error, misspelled keys
 */
export function isType<T extends object>(
  maybeType: unknown,
  expectedKeys: readonly (keyof T)[]
): maybeType is T {
  const object = maybeType as {[key: string]: unknown};
  return expectedKeys.every(key => key in object);
}

export function assertIsArray(x: unknown): asserts x is Array<unknown> {
  if (!isArray(x)) throw new Error('Not an Array');
}

export function isArray(x: unknown): x is Array<unknown> {
  return Array.isArray(x);
}

export function assertIsDefined<T>(
  value: T,
  errorMessage = 'Value is not defined'
): asserts value is NonNullable<T> {
  if (value === undefined || value === null) {
    throw new Error(errorMessage);
  }
}

//region scalarTypes
export function assertIsNumber(x: unknown): asserts x is number {
  if (typeof x !== 'number') {
    throw new Error(`Expected number, got ${x}`);
  }
}

export function assertString(
  maybeString: unknown,
  message?: string
): asserts maybeString is string {
  const actualType = typeof maybeString;
  if (actualType !== 'string')
    throw new Error(
      message ??
        `maybeString: ${maybeString} isn't a string\n type:${actualType}`
    );
}
//endregion
