import { resolve as pathResolve } from 'node:path';
import postgres, { PostgresError } from 'postgres';
import migrate, { SqergeError } from './index';

export default async function bootstrap() {
  const log: typeof console.log = (message, ...args) =>
    console.log(
      `\u001b[35m[\u001b[39m\u001b[36msqerge\u001b[39m\u001b[35m]\u001b[39m ${message}`,
      ...args,
    );

  const logError: typeof console.log = (message, ...args) =>
    console.error(
      `\u001b[35m[\u001b[39m\u001b[36msqerge\u001b[39m\u001b[35m]\u001b[39m \u001b[1m\u001b[31m(error)\u001b[39m\u001b[22m ${message}`,
      ...args,
    );

  // Exit with an error, instead of 0, if the process runs out of work before
  // the migration settles.
  let settled = false;
  process.exitCode = 1;
  process.on('exit', () => {
    if (!settled) logError('exited before the migration finished');
  });

  try {
    const dir = pathResolve(process.argv[2] ?? './');

    const sql = postgres({
      onnotice: () => {},
    });

    await migrate(sql, dir, { log, role: process.env.ROLE });
    settled = true;
    process.exitCode = 0;

    await sql.end();
  } catch (error) {
    settled = true;

    if (isNodeError(error, Error)) {
      if (error instanceof SqergeError || error instanceof PostgresError) {
        logError(error.message);
      } else if (error.code === 'ECONNREFUSED') {
        // Node tries each address of a host like localhost, and throws an
        // AggregateError, with an empty message, if they all refuse.
        const errors: Error[] =
          error instanceof AggregateError ? error.errors : [error];

        logError(
          'database connection refused at %O',
          errors.map((e) => e.message.split('ECONNREFUSED ')[1]).join(', '),
        );
      } else if (
        typeof error.code === 'string' &&
        error.code.startsWith('CONNECTION_')
      ) {
        logError('database connection closed');
      } else if (error.code === 'ENOTFOUND') {
        logError(
          'database host not found at %O',
          error.message.split('ENOTFOUND ')[1],
        );
      } else {
        console.error(error);
      }
    } else {
      console.error(error);
    }

    process.exit(1);
  }
}

function isNodeError<T extends new (...args: any) => Error>(
  value: unknown,
  errorType: T,
): value is InstanceType<T> & NodeJS.ErrnoException {
  return value instanceof errorType;
}
