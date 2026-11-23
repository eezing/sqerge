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

   The filename **prefix** represents the execution order, a unique integer followed by a hyphen, such as `1-` or a timestamp like `20261123120000-`. After the hyphen, it's all yours. Files not matching the prefix are ignored.

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

## Transactions

sqerge executes migration files in a single transaction, so if one fails, none of the files in that run are applied.

Some statements, such as `CREATE INDEX CONCURRENTLY`, can't run in a transaction. To execute a file outside of a transaction, add **.no-transaction** before the extension. This works for **.sql**, **.js** and **.mjs** files.

```sql
-- file: ./foo/4-qux.no-transaction.sql

CREATE INDEX CONCURRENTLY person_name_idx ON person ("name");
```

sqerge commits the files before a no-transaction file, executes it on its own, then starts a new transaction for the files after it.

- A no-transaction file can't be rolled back, and it's recorded as migrated only after it succeeds. If it fails, or sqerge stops before recording it, undo its changes, such as an invalid index, before you run sqerge again.
- sqerge sends a SQL file as one query, and PostgreSQL runs a query with more than one statement in a transaction. Put one statement in each `.no-transaction.sql` file, or use a `.no-transaction.js` or `.no-transaction.mjs` file, which runs each query on its own.

## Concurrent Runs

sqerge holds a PostgreSQL advisory lock while it runs, so if you start it twice against the same database, such as from several app instances, the second run waits for the first to finish, then skips the files it already migrated.

The lock and ROLE need one database session for the whole run, so connect sqerge directly to PostgreSQL, or through a pooler in session mode, not transaction mode.

## Environment Variables

- Use **Postgres.js** [environment variables](https://github.com/porsager/postgres#environmental-variables) for your database **connection**.

- **ROLE** (optional)

  Execute migration with the specified database role. This is helpful for when your `LOGIN` role has a `NOINHERIT` membership to another role containting privileges required for your migration. If ROLE is provided, sqerge will execute `SET ROLE` for the session and then execute your migration files.
