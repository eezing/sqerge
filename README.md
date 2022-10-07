# sqerge

[![On Push](https://github.com/eezing/sqerge/actions/workflows/on-push.yml/badge.svg?branch=main)](https://github.com/eezing/sqerge/actions/workflows/on-push.yml)

A forward only PostgreSQL migration tool. Uses [Postgres.js](https://github.com/porsager/postgres) library under the hood.

## Get Started

1. Install to devDependencies
   ```sh
   npm i sqerge -D
   ```
2. Choose a migration directory
   ```sh
   mkdir foo
   ```
3. Create some migration files

   The filename **prefix** represents the execution order, a unique integer followed by a hyphen. After the hyphen, it's all yours. Files not matching the prefix are ignored.

   - `./foo/1-bar.sql`:

     ```sql
     CREATE TABLE person (
       "id" SERIAL PRIMARY KEY,
       "name" text NOT NULL
     );
     ```

   - `./foo/2-biz.sql`:

     ```sql
     ALTER TABLE person
       ADD COLUMN "age" smallint;
     ```

   - `./foo/3-baz.js`:

     In addition to `.sql`, migration files can also end in `.js`. JavaScript files must **default export a function**. The 1st argument is a [Postgres.js](https://github.com/porsager/postgres) instance.

     ```js
     module.exports = async (sql) => {
       await sql`
         INSERT INTO person
           ("name", "age")
         VALUES
           ('Luke Skywalker', '21');
       `;
     };
     ```

4. Execute migration

   Command:

   **Note:** Use [environment variables](https://www.postgresql.org/docs/current/libpq-envars.html) for your database connection. Supported environment variables are at the discretion of [Postgres.js](https://github.com/porsager/postgres).

   ```sh
   PGHOST=localhost PGPORT=5438 PGUSER=jonathan PGPASSWORD=iliketurtles PGDATABASE=dev npx sqerge ./foo
   ```

   Output:

   ```sh
   [sqerge] 3 file(s) found in '/Users/jonathan/Desktop/foo'
   [sqerge] file 1 (1-bar.sql): executed
   [sqerge] file 2 (2-biz.sql): executed
   [sqerge] file 3 (3-baz.js): executed
   ```
