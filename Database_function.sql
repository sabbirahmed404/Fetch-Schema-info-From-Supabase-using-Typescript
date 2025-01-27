-- Drop existing functions to ensure clean recreation
DROP FUNCTION IF EXISTS public.get_schema_info();
DROP FUNCTION IF EXISTS public.get_tables();
DROP FUNCTION IF EXISTS public.get_functions();

-- Function to get all functions in the database
CREATE OR REPLACE FUNCTION public.get_functions()
RETURNS TABLE (
    function_name text,
    language text,
    return_type text,
    argument_types text,
    definition text,
    description text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        p.proname::text,
        l.lanname::text,
        pg_get_function_result(p.oid)::text,
        pg_get_function_arguments(p.oid)::text,
        pg_get_functiondef(p.oid)::text,
        d.description::text
    FROM pg_proc p
    LEFT JOIN pg_language l ON p.prolang = l.oid
    LEFT JOIN pg_description d ON p.oid = d.objoid
    WHERE p.pronamespace = 'public'::regnamespace;
$$;

-- Function to get detailed table information
CREATE OR REPLACE FUNCTION public.get_tables()
RETURNS TABLE (
    table_name text,
    columns jsonb,
    constraints jsonb,
    foreign_keys jsonb,
    indexes jsonb,
    triggers jsonb,
    policies jsonb
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    WITH table_list AS (
        SELECT c.relname
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
    ),
    columns_info AS (
        SELECT 
            c.relname as table_name,
            jsonb_object_agg(
                a.attname,
                jsonb_build_object(
                    'data_type', format_type(a.atttypid, a.atttypmod),
                    'is_nullable', CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END,
                    'column_default', pg_get_expr(d.adbin, d.adrelid),
                    'description', col_description(c.oid, a.attnum)
                )
            ) as columns
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
        LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0
        GROUP BY c.relname, c.oid
    ),
    constraints_info AS (
        SELECT 
            tc.table_name,
            jsonb_object_agg(
                tc.constraint_name,
                jsonb_build_object(
                    'constraint_type', tc.constraint_type,
                    'definition', pg_get_constraintdef(pgc.oid)
                )
            ) as constraints
        FROM information_schema.table_constraints tc
        JOIN pg_constraint pgc ON tc.constraint_name = pgc.conname
        WHERE tc.table_schema = 'public'
        GROUP BY tc.table_name
    ),
    foreign_keys_info AS (
        SELECT 
            tc.table_name,
            jsonb_object_agg(
                tc.constraint_name,
                jsonb_build_object(
                    'column_name', kcu.column_name,
                    'foreign_table_name', ccu.table_name,
                    'foreign_column_name', ccu.column_name
                )
            ) as foreign_keys
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
        GROUP BY tc.table_name
    ),
    indexes_info AS (
        SELECT 
            tablename as table_name,
            jsonb_object_agg(
                indexname,
                jsonb_build_object(
                    'indexdef', indexdef
                )
            ) as indexes
        FROM pg_indexes
        WHERE schemaname = 'public'
        GROUP BY tablename
    ),
    triggers_info AS (
        SELECT 
            event_object_table as table_name,
            jsonb_object_agg(
                trigger_name,
                jsonb_build_object(
                    'action_timing', action_timing,
                    'event_manipulation', event_manipulation,
                    'action_statement', action_statement
                )
            ) as triggers
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        GROUP BY event_object_table
    ),
    policies_info AS (
        SELECT 
            tablename as table_name,
            jsonb_object_agg(
                policyname,
                jsonb_build_object(
                    'command', cmd,
                    'permissive', permissive,
                    'roles', roles,
                    'qual', qual,
                    'with_check', with_check
                )
            ) as policies
        FROM pg_policies
        WHERE schemaname = 'public'
        GROUP BY tablename
    )
    SELECT 
        t.relname,
        COALESCE(ci.columns, '{}'::jsonb),
        COALESCE(con.constraints, '{}'::jsonb),
        COALESCE(fk.foreign_keys, '{}'::jsonb),
        COALESCE(i.indexes, '{}'::jsonb),
        COALESCE(tr.triggers, '{}'::jsonb),
        COALESCE(p.policies, '{}'::jsonb)
    FROM table_list tl
    JOIN pg_class t ON t.relname = tl.relname
    LEFT JOIN columns_info ci ON ci.table_name = tl.relname
    LEFT JOIN constraints_info con ON con.table_name = tl.relname
    LEFT JOIN foreign_keys_info fk ON fk.table_name = tl.relname
    LEFT JOIN indexes_info i ON i.table_name = tl.relname
    LEFT JOIN triggers_info tr ON tr.table_name = tl.relname
    LEFT JOIN policies_info p ON p.table_name = tl.relname;
$$;

-- Main function to get complete schema information
CREATE OR REPLACE FUNCTION public.get_schema_info()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
    WITH view_definitions AS (
        SELECT 
            c.relname as view_name,
            pg_get_viewdef(c.oid, true) as definition,
            jsonb_object_agg(
                a.attname,
                jsonb_build_object(
                    'data_type', format_type(a.atttypid, a.atttypmod),
                    'description', col_description(c.oid, a.attnum)
                )
            ) as columns
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0
        WHERE n.nspname = 'public' AND c.relkind = 'v'
        GROUP BY c.relname, c.oid
    )
    SELECT jsonb_build_object(
        'tables', COALESCE(
            (SELECT jsonb_agg(to_jsonb(t)) FROM get_tables() t),
            '[]'::jsonb
        ),
        'views', COALESCE(
            (SELECT jsonb_agg(to_jsonb(v)) FROM view_definitions v),
            '[]'::jsonb
        ),
        'functions', COALESCE(
            (SELECT jsonb_agg(to_jsonb(f)) FROM get_functions() f),
            '[]'::jsonb
        )
    );
$$;
