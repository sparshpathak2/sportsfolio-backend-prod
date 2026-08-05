#!/bin/bash
# Runs once, automatically, on first container start (empty data dir only).
# Creates two DB roles:
#   - app_user      -> loaded into the always-running backend container. CRUD only, no DDL.
#   - migrate_user   -> used ONLY by the one-off `migrate` compose service. Can create/alter tables.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE USER app_user WITH PASSWORD '${APP_DB_PASSWORD}';
  CREATE USER migrate_user WITH PASSWORD '${MIGRATE_DB_PASSWORD}';

  GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO app_user, migrate_user;

  GRANT USAGE, CREATE ON SCHEMA public TO migrate_user;
  GRANT USAGE ON SCHEMA public TO app_user;

  -- app_user: only CRUD on tables that exist right now
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

  -- and on any tables migrate_user creates in the future (Prisma migrations)
  ALTER DEFAULT PRIVILEGES FOR ROLE migrate_user IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
  ALTER DEFAULT PRIVILEGES FOR ROLE migrate_user IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_user;
EOSQL