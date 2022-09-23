CREATE TABLE person (
  "id" SERIAL PRIMARY KEY,
  "name" text NOT NULL,
  "createdAt" timestamptz DEFAULT now()
);