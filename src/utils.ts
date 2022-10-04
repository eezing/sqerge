import colors from 'colors/safe';
import { formatWithOptions } from 'node:util';
import postgres, { PostgresError } from 'postgres';

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

export const sqlInit = (options: any) => {
  const sql = postgres({
    host: options.host,
    port: parseInt(options.port),
    user: options.user,
    password: options.password,
    database: options.database,
    onnotice: () => {},
  });

  process.on('exit', async () => {
    await sql.end();
  });

  return sql;
};

export const log: typeof console.log = (message, ...args) =>
  console.log(
    `${colors.magenta('[')}${colors.cyan('sqerge')}${colors.magenta(
      ']'
    )} ${message}`,
    ...args
  );

export function fileMessage(
  count: number,
  file: string,
  message: string,
  ...args: any
) {
  return formatWithOptions(
    { colors: true },
    `file %O (${colors.green(file)}): ${message}`,
    count,
    ...args
  );
}

export const withActionWrapper = <T extends (...args: any) => Promise<void>>(
  action: T
) =>
  (async (...args: any) => {
    try {
      await action(...args);
      process.exit(0);
    } catch (error) {
      if (isNodeError(error, Error)) {
        if (error instanceof SqergeError) {
          log(`${colors.bold(colors.red('(error)'))} ${error.message}`);
        } else if (error instanceof PostgresError) {
          log(
            `${colors.bold(colors.red('(database error)'))} ${error.message}`
          );
        } else if (error.code === 'ECONNREFUSED') {
          log(
            `${colors.bold(
              colors.red('(database error)')
            )} connection refused at %O`,
            error.message.split('ECONNREFUSED ')[1]
          );
        } else if (error.code === 'ENOTFOUND') {
          log(
            `${colors.bold(
              colors.red('(database error)')
            )} host not found at %O`,
            error.message.split('ENOTFOUND ')[1]
          );
        } else {
          console.error(error);
        }

        process.exit(1);
      }

      throw error;
    }
  }) as unknown as T;
