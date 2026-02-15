-- Transfer all ownership to aba_admin
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Transfer tables
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO aba_admin';
    END LOOP;

    -- Transfer sequences
    FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ALTER SEQUENCE public.' || quote_ident(r.sequencename) || ' OWNER TO aba_admin';
    END LOOP;

    -- Transfer types/enums
    FOR r IN SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e'
    LOOP
        EXECUTE 'ALTER TYPE public.' || quote_ident(r.typname) || ' OWNER TO aba_admin';
    END LOOP;
END
$$;

-- Also transfer schema ownership
ALTER SCHEMA public OWNER TO aba_admin;

-- Verify
SELECT 'Tables owned by aba_admin:' AS info;
SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'public';
