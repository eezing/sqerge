module.exports = async (sql) => {
  await sql`
    INSERT INTO person
      ("name", "age")
    VALUES
      ('Luke Skywalker', '21');
  `;
};
