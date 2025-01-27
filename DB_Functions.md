
# Run this function in your Database 

## Overview Functions

These functions are designed to provide comprehensive schema information from your Supabase database. They work together to gather detailed information about tables, views, functions, and their associated metadata.

## Core Functions

### 1. get_schema_info()

**Purpose**: Main function that aggregates all schema information including tables, views, and functions.

**Details**:
- Returns: `jsonb`
- Language: `sql`
- Security: `DEFINER`
- Access: Public

**Returns Structure**:
```json
{
  "tables": [
    {
      "table_name": "string",
      "columns": {},
      "constraints": {},
      "foreign_keys": {},
      "indexes": {},
      "triggers": {},
      "policies": {}
    }
  ],
  "views": [
    {
      "view_name": "string",
      "definition": "string",
      "columns": {}
    }
  ],
  "functions": [
    {
      "function_name": "string",
      "language": "string",
      "return_type": "string",
      "argument_types": "string",
      "definition": "string",
      "description": "string"
    }
  ]
}
```

### 2. get_tables()

**Purpose**: Retrieves detailed information about all tables in the public schema.

**Details**:
- Returns: `TABLE`
- Language: `sql`
- Security: `DEFINER`
- Access: Public

**Return Columns**:
```sql
table_name text,
columns jsonb,
constraints jsonb,
foreign_keys jsonb,
indexes jsonb,
triggers jsonb,
policies jsonb
```

**Component CTEs**:
- `table_list`: Lists all tables in public schema
- `columns_info`: Gathers column metadata
- `constraints_info`: Collects table constraints
- `foreign_keys_info`: Maps foreign key relationships
- `indexes_info`: Lists table indexes
- `triggers_info`: Compiles trigger information
- `policies_info`: Collects RLS policies

### 3. get_functions()

**Purpose**: Retrieves information about all functions in the public schema.

**Details**:
- Returns: `TABLE`
- Language: `sql`
- Security: `DEFINER`
- Access: Public

**Return Columns**:
```sql
function_name text,
language text,
return_type text,
argument_types text,
definition text,
description text
```

## Data Structures

### Table Information
```json
{
  "columns": {
    "column_name": {
      "data_type": "string",
      "is_nullable": "YES/NO",
      "column_default": "string",
      "description": "string"
    }
  },
  "constraints": {
    "constraint_name": {
      "constraint_type": "string",
      "definition": "string"
    }
  },
  "foreign_keys": {
    "constraint_name": {
      "column_name": "string",
      "foreign_table_name": "string",
      "foreign_column_name": "string"
    }
  },
  "indexes": {
    "index_name": {
      "indexdef": "string"
    }
  },
  "triggers": {
    "trigger_name": {
      "action_timing": "string",
      "event_manipulation": "string",
      "action_statement": "string"
    }
  },
  "policies": {
    "policy_name": {
      "command": "string",
      "permissive": "string",
      "roles": ["string"],
      "qual": "string",
      "with_check": "string"
    }
  }
}
```

### View Information
```json
{
  "view_name": "string",
  "definition": "SQL definition",
  "columns": {
    "column_name": {
      "data_type": "string",
      "description": "string"
    }
  }
}
```

## Usage Examples

### Fetch Complete Schema
```sql
SELECT * FROM get_schema_info();
```

### Get Table Details
```sql
SELECT * FROM get_tables() WHERE table_name = 'users';
```

### List All Functions
```sql
SELECT * FROM get_functions();
```

## Security Considerations

1. **Security Definer**:
   - All functions run with definer's privileges
   - Ensures consistent access to system catalogs
   - Maintains RLS integrity

2. **Access Control**:
   - Functions accessible in public schema
   - Requires appropriate role permissions
   - Respects database security policies

3. **Data Safety**:
   - No data modification operations
   - Read-only access to system catalogs
   - Safe for production use

## Performance Notes

1. **Optimization**:
   - Uses CTEs for efficient query organization
   - Implements proper indexing
   - Minimizes repeated catalog access

2. **Caching**:
   - Results can be cached at application level
   - Suitable for periodic schema analysis
   - Low impact on database performance

## Error Handling

1. **Null Safety**:
   - COALESCE used for null handling
   - Empty JSON arrays for missing data
   - Graceful handling of missing objects

2. **Type Safety**:
   - Explicit type casts
   - Proper JSON building
   - Consistent return types

## Maintenance

1. **Updates**:
   - Drop existing functions before recreation
   - Version control compatible
   - Backward compatible changes

2. **Monitoring**:
   - No persistent state
   - Minimal maintenance required
   - Self-documenting code

## Dependencies

1. **System Catalogs**:
   - pg_catalog
   - information_schema
   - pg_class
   - pg_attribute
   - pg_namespace

2. **Extensions**:
   - No additional extensions required
   - Core PostgreSQL functionality only

This documentation provides a comprehensive overview of the database functions used in the schema management system. It covers their purpose, structure, usage, and important considerations for implementation and maintenance.
