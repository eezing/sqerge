module.exports = async (sql) => {
  await sql`
    INSERT INTO person
      ("name")
    VALUES
      ('Han Solo'),
      ('Darth Vader');
  `;
};
