# sqerge

A forward only PostgreSQL migration tool. Uses [Postgres.js](https://github.com/porsager/postgres) library under the hood.

## Get Started

1. Install NPM package

   ```sh
   npm i sqerge -D
   ```

2. Install Postgres.js (may install as peerDependency automatically on NPM v7+)

   ```sh
   npm i postgres
   ```

3. Choose a migration directory
   ```sh
   mkdir foo
   ```
4. Create some migration files

   The filename **prefix** represents the execution order, a unique integer followed by a hyphen. After the hyphen, it's all yours. Files not matching the prefix are ignored.

   ```sql
   -- file: ./foo/1-bar.sql

   CREATE TABLE person (
     "id" SERIAL PRIMARY KEY,
     "name" text NOT NULL
   );
   ```

   ```sql
   -- file: ./foo/2-biz.sql

   ALTER TABLE person
     ADD COLUMN "age" smallint;
   ```

   In addition to **.sql**, migration files can also end in **.js** or **.mjs** for ES Modules. JavaScript files must **default export a function**. The 1st argument is a [Postgres.js](https://github.com/porsager/postgres) instance.

   ```js
   // file: ./foo/3-baz.js

   module.exports = async (sql) => {
     await sql`
       INSERT INTO person
         ("name", "age")
       VALUES
         ('Luke Skywalker', '21');
     `;
   };
   ```

5. Execute migration

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
