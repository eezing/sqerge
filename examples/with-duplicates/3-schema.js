module.exports = async (sql) => {
  await sql`
    INSERT INTO person
      ("name")
    VALUES
      ('Luke Skywalker'),
      ('Han Solo'),
      ('Darth Vader');
  `;
};
