CREATE TABLE person (
  "id" SERIAL PRIMARY KEY,
  "name" text NOT NULL
);

-- Hold the lock while the second run starts.
SELECT pg_sleep(1);
