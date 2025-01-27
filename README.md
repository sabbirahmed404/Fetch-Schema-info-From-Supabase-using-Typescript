# Schema Documentation Generator

A powerful tool to fetch and document your Supabase database schema. This tool generates comprehensive schema documentation in multiple formats and supports both tables and views.

## Features

- Multiple documentation formats (JSON, Markdown, SQL)
- Support for tables and views
- Detailed schema information including columns, constraints, indexes, triggers, and policies
- Command-line interface for different documentation needs
- Timestamp tracking for generated files
- File size reporting
- Organized directory structure

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Supabase project
- TypeScript environment

## Setup

1. **Environment Variables**
   Create a `.env` file in your project root:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_KEY=your_supabase_service_key
   ```

2. **Install Dependencies**
   ```bash
   npm install @supabase/supabase-js dotenv tsx
   ```

3. **Add Scripts to package.json**
   ```json
   {
     "scripts": {
       "fetch-schema": "tsx scripts/schema-manager.ts fetch-schema",
       "fetch-table": "tsx scripts/schema-manager.ts fetch-table",
       "fetch-docs": "tsx scripts/schema-manager.ts fetch-docs"
     }
   }
   ```

## Commands

1. **Fetch Complete Schema**
   ```bash
   npm run fetch-schema
   ```
   Creates all schema files in `Documentations/schema/`

2. **Fetch Single Table Schema**
   ```bash
   npm run fetch-table users
   ```
   Creates schema files for the "users" table in `Documentations/schema/users/`

3. **Fetch Documentation**
   ```bash
   npm run fetch-docs
   ```
   Generates documentation in `Documentations/schema/schema_others/`

## Generated Files

For each command, the following files are created:

1. **schema_info.json**
   - Timestamp of generation
   - Complete schema information in JSON format
   - Tables, views, and functions with their details
   - Columns, constraints, foreign keys, indexes, triggers, and policies

2. **schema_docs.md**
   - Overview statistics
   - Table and view documentation
   - Column definitions and types
   - Function documentation with arguments and return types
   - Formatted for easy reading

3. **schema.sql**
   - SQL commands to recreate the schema
   - Function definitions
   - View definitions
   - Table structures (when applicable)

## Directory Structure

```
project/
└── Documentations/
    └── schema/
        ├── schema_info.json    # Complete schema
        ├── schema_docs.md      # Complete documentation
        ├── schema.sql          # Complete SQL
        └── table_name/         # Individual table/view docs
            ├── schema_info.json
            ├── schema_docs.md
            └── schema.sql
```

## Features

- Automatic schema extraction
- Support for tables and views
- Multiple documentation formats
- Detailed object documentation:
  - Tables and views
  - Columns and their properties
  - Functions and procedures
  - Triggers and policies
  - Constraints and indexes
- File size reporting
- Timestamp tracking
- Organized directory structure
- Error handling
- Type safety with TypeScript

## Troubleshooting

1. **Connection Issues**
   - Verify environment variables
   - Check Supabase URL and keys
   - Ensure network connectivity

2. **Permission Errors**
   - Verify service role key permissions
   - Check access to system catalogs

3. **Empty or Incomplete Files**
   - Check console for error messages
   - Verify schema access permissions
   - Ensure database functions exist

## Security Notes

- Keep your `SUPABASE_SERVICE_KEY` secure
- Never commit environment variables
- Use `.gitignore` for sensitive files
- Consider using environment variable management tools

## Type Support

The tool includes TypeScript interfaces for all schema components:
- `TableInfo`
- `ViewInfo`
- `TableColumn`
- `TableConstraint`
- `TableIndex`
- `TableTrigger`
- `TablePolicy`
- `DatabaseFunction`

This ensures type safety when working with the generated schema information programmatically.

## Contributing

Feel free to submit issues and enhancement requests. Follow these steps:
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
