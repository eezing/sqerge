const { execSync } = require('child_process');
const postgres = require('postgres');

const host = 'localhost';
const port = 5438;
const user = 'jonathan';
const password = 'iliketurtles';

const initDatabase = 'postgres';
const devDatabase = 'dev';

(async () => {
  try {
    console.log('checking for existing docker container...');
    execSync(`docker inspect sqerge`, { stdio: 'ignore' });

    console.log('starting existing docker container...');
    execSync(`docker start sqerge`, { stdio: 'ignore' });
  } catch (e) {
    console.log('running new docker container...');
    execSync(
      `docker run --name sqerge -p ${port}:5432 -e POSTGRES_USER=${user} -e POSTGRES_PASSWORD=${password} -e POSTGRES_DB=${initDatabase} -d postgres`
    );

    await new Promise((res) => setTimeout(res, 3000));
  }

  const sql = postgres({
    host,
    port,
    user,
    password,
    database: initDatabase,
    onnotice: () => {},
  });

  try {
    console.log(`(re)creating "${devDatabase}" database...`);
    await sql`select pg_terminate_backend(pg_stat_activity.pid) from pg_stat_activity where pid <> pg_backend_pid();`;
    await sql`drop database if exists ${sql(devDatabase)};`;
    await sql`create database ${sql(devDatabase)};`;
  } catch (error) {
    throw error;
  } finally {
    sql.end();
  }

  console.log('done!');
})();
