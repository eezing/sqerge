// Closes the connection in the middle of the transaction.
export default (sql) => sql`SELECT pg_terminate_backend(pg_backend_pid());`;
