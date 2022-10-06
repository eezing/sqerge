module.exports = async (sql, flags) => {
  await sql`
    INSERT INTO person
      ("name", "age")
    VALUES
      ('Luke Skywalker', '21');
  `;
};
