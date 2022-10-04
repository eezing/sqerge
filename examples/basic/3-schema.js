module.exports = async (sql, flags) => {
  await sql`
    INSERT INTO person
      ("name")
    VALUES
      ('Luke Skywalker');
  `;
};
