export default (sql) => sql`
    CREATE INDEX CONCURRENTLY person_age_idx ON person ("age");
  `;
