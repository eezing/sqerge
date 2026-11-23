CREATE TABLE person (
  "id" SERIAL PRIMARY KEY,
  "name" text NOT NULL
);

-- Run longer than the test's PGMAX_LIFETIME, which sqerge's connection ignores.
SELECT pg_sleep(1.5);
