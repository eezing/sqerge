import colors from 'colors/safe';
import { formatWithOptions } from 'node:util';
import { PostgresError } from 'postgres';

export function isNodeError<T extends new (...args: any) => Error>(
  value: unknown,
  errorType: T
): value is InstanceType<T> & NodeJS.ErrnoException {
  return value instanceof errorType;
}

export class SqergeError extends Error {
  constructor(public code: string, message: string, ...args: any) {
    super(formatWithOptions({ colors: true }, message, ...args));
  }
}

export const log = (message: string, ...args: any) =>
  console.log(
    `${colors.green('[')}${colors.cyan('sqerge')}${colors.green(
      ']'
    )} ${message}`,
    ...args
  );

export async function withSqergeErrorHandler(callback: () => Promise<void>) {
  try {
    await callback();
  } catch (error) {
    if (error instanceof SqergeError) {
      log(`${colors.bold(colors.red('(error)'))} ${error.message}`);
      process.exit(1);
    } else if (error instanceof PostgresError) {
      log(`${colors.bold(colors.red('(database error)'))} ${error.message}`);
      process.exit(1);
    } else if (isNodeError(error, Error)) {
      if (error.code === 'ECONNREFUSED') {
        log(
          `${colors.bold(
            colors.red('(database error)')
          )} connection refused at %O`,
          error.message.split('ECONNREFUSED ')[1]
        );
        process.exit(1);
      } else if (error.code === 'ENOTFOUND') {
        log(
          `${colors.bold(colors.red('(database error)'))} host not found at %O`,
          error.message.split('ENOTFOUND ')[1]
        );
        process.exit(1);
      }
    }

    throw error;
  }
}

export function groupByFirstMatch(
  items: string[],
  pattern: RegExp
): [string, string[]][] {
  const map = new Map<string, string[]>();

  for (const item of items) {
    const check = pattern.exec(item);

    if (check) {
      const match = check[1];
      const matchList = map.get(match);

      if (matchList) {
        matchList.push(item);
      } else {
        map.set(match, [item]);
      }
    }
  }

  return Array.from(map.entries());
}
