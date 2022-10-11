export default (sql) => sql`
    INSERT INTO person
      ("name", "age")
    VALUES
      ('Han Solo', '25');
  `;
