module.exports = async (sql, flags) => {
  await sql`
    INSERT INTO person
      ("name")
    VALUES
      ('Luke Skywalker');
  `;

  if (flags.solo) {
    await sql`
      INSERT INTO person
        ("name")
      VALUES
        ('Han Solo');
  `;
  }

  if (flags.vader) {
    await sql`
      INSERT INTO person
        ("name")
      VALUES
        ('Darth Vader');
  `;
  }
};
