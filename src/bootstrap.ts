import { resolve as pathResolve } from 'node:path';
import postgres, { PostgresError } from 'postgres';
import migrate, { SqergeError } from './index';

export default async function bootstrap() {
  const log: typeof console.log = (message, ...args) =>
    console.log(
      `\u001b[35m[\u001b[39m\u001b[36msqerge\u001b[39m\u001b[35m]\u001b[39m ${message}`,
      ...args
    );

  const logError: typeof console.log = (message, ...args) =>
    log(`\u001b[1m\u001b[31m(error)\u001b[39m\u001b[22m ${message}`, ...args);

  try {
    const dir = pathResolve(process.argv[2] ?? './');

    const sql = postgres({
      onnotice: () => {},
    });

    process.on('exit', async () => {
      await sql.end();
    });

    await migrate(sql, dir, { log, role: process.env.ROLE });

    await sql.end();
  } catch (error) {
    if (isNodeError(error, Error)) {
      if (error instanceof SqergeError || error instanceof PostgresError) {
        logError(error.message);
      } else if (error.code === 'ECONNREFUSED') {
        logError(
          'database connection refused at %O',
          error.message.split('ECONNREFUSED ')[1]
        );
      } else if (error.code === 'ENOTFOUND') {
        logError(
          'database host not found at %O',
          error.message.split('ENOTFOUND ')[1]
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
  errorType: T
): value is InstanceType<T> & NodeJS.ErrnoException {
  return value instanceof errorType;
}
