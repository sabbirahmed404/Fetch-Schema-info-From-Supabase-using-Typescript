# Schema Documentation Generator

This tool automatically generates comprehensive database schema documentation from your Supabase project. It creates three types of documentation files:

1. `schema_info.json` - Raw schema data in JSON format
2. `schema_docs.md` - Human-readable documentation in Markdown
3. `schema.sql` - SQL commands to recreate the schema

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Supabase project
- TypeScript environment

## Setup

1. **Environment Variables**
   Create a `.env` file in your project root with:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_KEY=your_supabase_service_key  # From Project Settings -> API
   ```

2. **Install Dependencies**
   ```bash
   npm install @supabase/supabase-js dotenv tsx
   ```

3. **Create Database Function**
   Run this SQL in your Supabase SQL editor:
   ```sql
   CREATE OR REPLACE FUNCTION get_schema_info()
   RETURNS JSONB
   LANGUAGE plpgsql
   AS $$
   DECLARE
       result JSONB;
   BEGIN
       WITH table_info AS (
           SELECT 
               t.table_name,
               jsonb_agg(
                   jsonb_build_object(
                       'column_name', c.column_name,
                       'data_type', c.data_type,
                       'is_nullable', c.is_nullable,
                       'column_default', c.column_default,
                       'description', col_description((t.table_schema || '.' || t.table_name)::regclass, c.ordinal_position)
                   )
               ) AS columns,
               (
                   SELECT jsonb_agg(
                       jsonb_build_object(
                           'column_name', kcu.column_name,
                           'foreign_table_name', ccu.table_name,
                           'foreign_column_name', ccu.column_name,
                           'constraint_name', tc.constraint_name
                       )
                   )
                   FROM information_schema.table_constraints tc
                   JOIN information_schema.key_column_usage kcu 
                       ON tc.constraint_name = kcu.constraint_name
                   JOIN information_schema.constraint_column_usage ccu
                       ON ccu.constraint_name = tc.constraint_name
                   WHERE tc.constraint_type = 'FOREIGN KEY'
                   AND tc.table_name = t.table_name
                   AND tc.table_schema = t.table_schema
               ) AS foreign_keys,
               (
                   SELECT jsonb_agg(
                       jsonb_build_object(
                           'constraint_name', tc.constraint_name,
                           'constraint_type', tc.constraint_type,
                           'column_names', (
                               SELECT jsonb_agg(kcu.column_name)
                               FROM information_schema.key_column_usage kcu
                               WHERE kcu.constraint_name = tc.constraint_name
                           ),
                           'definition', pg_get_constraintdef(pgc.oid)
                       )
                   )
                   FROM information_schema.table_constraints tc
                   JOIN pg_constraint pgc ON tc.constraint_name = pgc.conname
                   WHERE tc.table_name = t.table_name
                   AND tc.table_schema = t.table_schema
               ) AS constraints,
               (
                   SELECT jsonb_agg(
                       jsonb_build_object(
                           'indexname', indexname,
                           'indexdef', indexdef
                       )
                   )
                   FROM pg_indexes
                   WHERE schemaname = t.table_schema AND tablename = t.table_name
               ) AS indexes,
               (
                   SELECT jsonb_agg(
                       jsonb_build_object(
                           'trigger_name', tg.trigger_name,
                           'event_manipulation', tg.event_manipulation,
                           'action_timing', tg.action_timing,
                           'action_statement', tg.action_statement,
                           'function_definition', pg_get_functiondef(p.oid)
                       )
                   )
                   FROM information_schema.triggers tg
                   JOIN pg_trigger pgt ON tg.trigger_name = pgt.tgname
                   JOIN pg_proc p ON pgt.tgfoid = p.oid
                   WHERE tg.event_object_schema = t.table_schema
                   AND tg.event_object_table = t.table_name
               ) AS triggers,
               (
                   SELECT jsonb_agg(
                       jsonb_build_object(
                           'policyname', policyname,
                           'tablename', tablename,
                           'command', cmd,
                           'permissive', permissive,
                           'roles', roles,
                           'using', qual,
                           'with_check', with_check
                       )
                   )
                   FROM pg_policies
                   WHERE schemaname = t.table_schema AND tablename = t.table_name
               ) AS policies
           FROM information_schema.tables t
           JOIN information_schema.columns c 
               ON c.table_name = t.table_name 
               AND c.table_schema = t.table_schema
           WHERE t.table_schema = 'public'
           AND t.table_type = 'BASE TABLE'
           GROUP BY t.table_schema, t.table_name
       ),
       function_info AS (
           SELECT jsonb_agg(
               jsonb_build_object(
                   'function_name', p.proname,
                   'language', l.lanname,
                   'return_type', pg_get_function_result(p.oid),
                   'argument_types', pg_get_function_arguments(p.oid),
                   'definition', pg_get_functiondef(p.oid),
                   'description', d.description
               )
           ) AS functions
           FROM pg_proc p
           JOIN pg_namespace n ON p.pronamespace = n.oid
           JOIN pg_language l ON p.prolang = l.oid
           LEFT JOIN pg_description d ON p.oid = d.objoid
           WHERE n.nspname = 'public'
       )
       SELECT jsonb_build_object(
           'tables', COALESCE((
               SELECT jsonb_agg(
                   jsonb_build_object(
                       'table_name', table_name,
                       'columns', COALESCE(columns, '[]'::jsonb),
                       'foreign_keys', COALESCE(foreign_keys, '[]'::jsonb),
                       'constraints', COALESCE(constraints, '[]'::jsonb),
                       'indexes', COALESCE(indexes, '[]'::jsonb),
                       'triggers', COALESCE(triggers, '[]'::jsonb),
                       'policies', COALESCE(policies, '[]'::jsonb)
                   )
               )
               FROM table_info
           ), '[]'::jsonb),
           'functions', COALESCE((SELECT functions FROM function_info), '[]'::jsonb)
       )
       INTO result;

       RETURN COALESCE(result, '{}'::jsonb);
   END;
   $$;
   ```

4. **Add Script to package.json**
   ```json
   {
     "scripts": {
       "fetch-schema": "tsx scripts/fetch-schema.ts"
     }
   }
   ```

## Usage

Run the documentation generator:
```bash
npm run fetch-schema
```

This will create/update three files in the `Documentations` directory:
- `schema_info.json`: Raw schema data
- `schema_docs.md`: Markdown documentation
- `schema.sql`: SQL creation scripts

## Output Files

1. **schema_info.json**
   - Complete schema information in JSON format
   - Includes tables, columns, foreign keys, indexes, and RLS policies
   - All database functions and their definitions
   - All triggers and their functions
   - All constraints (CHECK, UNIQUE, PRIMARY KEY)
   - Useful for programmatic access to schema information

2. **schema_docs.md**
   - Human-readable documentation
   - Table of contents
   - Detailed information for each table
   - Column definitions, indexes, and policies
   - Function and trigger documentation
   - Constraint definitions

3. **schema.sql**
   - SQL commands to recreate the database structure
   - Includes table creation commands
   - Function definitions
   - Trigger definitions
   - Constraint definitions
   - Index definitions
   - RLS policy setup

## Features

- Automatic schema extraction
- Multiple documentation formats
- Complete database object documentation:
  - Tables and columns
  - Functions and procedures
  - Triggers and their functions
  - All types of constraints
  - Foreign key relationships
  - Indexes
  - RLS policies
- Error handling and retries
- File content verification

## Troubleshooting

1. **Permission Issues**
   - Ensure you're using the service key from Supabase dashboard
   - Check that the role has necessary permissions
   - Verify access to system catalogs (pg_proc, pg_trigger, etc.)

2. **Empty Files**
   - Verify environment variables are set correctly
   - Check Supabase connection
   - Look for error messages in the console

3. **SQL Function Error**
   - Ensure the `get_schema_info` function is created in your database
   - Check for any syntax errors in the function
   - Verify permissions on system catalogs

## Security Note

Keep your `SUPABASE_SERVICE_KEY` secure and never commit it to version control. Always use environment variables for sensitive information. 