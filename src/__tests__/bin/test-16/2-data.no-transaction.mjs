// Closes the connection, then queries again, which must not reconnect.
export default async (sql) => {
  await sql`SELECT pg_terminate_backend(pg_backend_pid());`.catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 100));
  await sql`INSERT INTO person ("name") VALUES ('Luke Skywalker');`;
};
