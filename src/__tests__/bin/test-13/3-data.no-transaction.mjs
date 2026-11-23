export default (sql) => sql`
    INSERT INTO person
      ("name")
    VALUES
      ('Luke Skywalker');
  `;
