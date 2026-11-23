// Ends the connection and never settles, like a stalled run.
export default (sql) => {
  sql.end();
  return new Promise(() => {});
};
