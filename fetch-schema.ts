import { createClient, PostgrestError } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Get current file path in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  description: string | null;
}

interface ForeignKey {
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
  constraint_name: string;
}

interface TableConstraint {
  constraint_name: string;
  constraint_type: string;
  column_names: string[] | null;
  definition: string;
}

interface TableIndex {
  indexname: string;
  indexdef: string;
}

interface TableTrigger {
  trigger_name: string;
  action_timing: string;
  event_manipulation: string;
  action_statement: string;
  function_definition: string;
}

interface TablePolicy {
  policyname: string;
  command: string;
  permissive: string;
  roles: string[] | null;
  using: string | null;
  with_check: string | null;
}

interface DatabaseFunction {
  function_name: string;
  language: string;
  return_type: string;
  argument_types: string;
  definition: string;
  description: string | null;
}

interface TableInfo {
  table_name: string;
  columns: TableColumn[] | null;
  constraints: TableConstraint[] | null;
  foreign_keys: ForeignKey[] | null;
  indexes: TableIndex[] | null;
  triggers: TableTrigger[] | null;
  policies: TablePolicy[] | null;
}

interface SchemaInfo {
  tables: TableInfo[] | null;
  functions: DatabaseFunction[] | null;
}

async function fetchDatabaseInfo(): Promise<SchemaInfo> {
  try {
    console.log('Connecting to Supabase...');
    
    // Add retry logic
    const maxRetries = 3;
    let retries = 0;
    let data: SchemaInfo | null = null;
    let error: PostgrestError | null = null;

    while (retries < maxRetries) {
      console.log(`Attempt ${retries + 1} of ${maxRetries}`);
      const result = await supabase.rpc('get_schema_info');
      
      if (!result.error && result.data) {
        data = result.data as SchemaInfo;
        break;
      }
      
      error = result.error;
      retries++;
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
      }
    }

    if (error) {
      console.error('Error executing schema query after retries:', error);
      throw error;
    }

    if (!data) {
      console.warn('No data returned from get_schema_info');
      return { tables: [], functions: [] };
    }

    console.log('Successfully fetched schema info');
    console.log('Number of tables:', data.tables?.length || 0);
    console.log('Number of functions:', data.functions?.length || 0);

    // Save to file for debugging
    const outputPath = path.join(path.dirname(__dirname), 'schema-debug.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`Debug output written to ${outputPath}`);

    return data;
  } catch (error) {
    console.error('Error fetching database info:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

function generateMarkdown(schemaInfo: SchemaInfo): string {
  let markdown = '# Database Schema Documentation\n\n';
  
  // Overview
  markdown += '## Overview\n\n';
  markdown += `- Total Tables: ${schemaInfo.tables?.length || 0}\n`;
  markdown += `- Total Functions: ${schemaInfo.functions?.length || 0}\n\n`;
  
  // Table of Contents
  markdown += '## Table of Contents\n\n';
  markdown += '### Tables\n';
  (schemaInfo.tables || []).forEach(table => {
    markdown += `- [${table.table_name}](#${table.table_name.toLowerCase()})\n`;
  });
  markdown += '\n### Functions\n';
  (schemaInfo.functions || []).forEach(func => {
    markdown += `- [${func.function_name}](#${func.function_name.toLowerCase()})\n`;
  });
  markdown += '\n';

  // Tables
  markdown += '## Tables\n\n';
  (schemaInfo.tables || []).forEach(table => {
    markdown += `### ${table.table_name}\n\n`;

    // Columns
    markdown += '#### Columns\n\n';
    markdown += '| Name | Type | Nullable | Default | Description |\n';
    markdown += '|------|------|----------|----------|-------------|\n';
    (table.columns || []).forEach(col => {
      markdown += `| ${col.column_name} | ${col.data_type} | ${col.is_nullable} | ${col.column_default || 'NULL'} | ${col.description || '-'} |\n`;
    });
    markdown += '\n';

    // Constraints
    const constraints = table.constraints || [];
    if (constraints.length > 0) {
      markdown += '#### Constraints\n\n';
      markdown += '| Name | Type | Columns | Definition |\n';
      markdown += '|------|------|---------|------------|\n';
      constraints.forEach(constraint => {
        markdown += `| ${constraint.constraint_name} | ${constraint.constraint_type} | ${(constraint.column_names || []).join(', ')} | ${constraint.definition} |\n`;
      });
      markdown += '\n';
    }

    // Foreign Keys
    const foreignKeys = table.foreign_keys || [];
    if (foreignKeys.length > 0) {
      markdown += '#### Foreign Keys\n\n';
      markdown += '| Column | References | Constraint Name |\n';
      markdown += '|--------|------------|----------------|\n';
      foreignKeys.forEach(fk => {
        markdown += `| ${fk.column_name} | ${fk.foreign_table_name}(${fk.foreign_column_name}) | ${fk.constraint_name} |\n`;
      });
      markdown += '\n';
    }

    // Indexes
    const indexes = table.indexes || [];
    if (indexes.length > 0) {
      markdown += '#### Indexes\n\n';
      markdown += '| Name | Definition |\n';
      markdown += '|------|------------|\n';
      indexes.forEach(idx => {
        markdown += `| ${idx.indexname} | ${idx.indexdef} |\n`;
      });
      markdown += '\n';
    }

    // Triggers
    const triggers = table.triggers || [];
    if (triggers.length > 0) {
      markdown += '#### Triggers\n\n';
      triggers.forEach(trigger => {
        markdown += `##### ${trigger.trigger_name}\n`;
        markdown += `- Timing: ${trigger.action_timing}\n`;
        markdown += `- Event: ${trigger.event_manipulation}\n`;
        markdown += `- Statement: ${trigger.action_statement}\n`;
        markdown += '```sql\n' + trigger.function_definition + '\n```\n\n';
      });
    }

    // RLS Policies
    const policies = table.policies || [];
    if (policies.length > 0) {
      markdown += '#### Row Level Security Policies\n\n';
      markdown += '| Name | Command | Permissive | Roles | Using | With Check |\n';
      markdown += '|------|---------|------------|-------|-------|------------|\n';
      policies.forEach(policy => {
        markdown += `| ${policy.policyname} | ${policy.command} | ${policy.permissive} | ${(policy.roles || []).join(', ')} | ${policy.using || '-'} | ${policy.with_check || '-'} |\n`;
      });
      markdown += '\n';
    }
  });

  // Functions
  markdown += '## Functions\n\n';
  (schemaInfo.functions || []).forEach(func => {
    markdown += `### ${func.function_name}\n\n`;
    markdown += `- Language: ${func.language}\n`;
    markdown += `- Returns: ${func.return_type}\n`;
    markdown += `- Arguments: ${func.argument_types}\n`;
    if (func.description) {
      markdown += `- Description: ${func.description}\n`;
    }
    markdown += '\n```sql\n' + func.definition + '\n```\n\n';
  });

  return markdown;
}

function generateSQL(schemaInfo: SchemaInfo): string {
  let sql = '-- Database Schema\n\n';

  // Functions first (they might be needed by triggers)
  sql += '-- Functions\n';
  (schemaInfo.functions || []).forEach(func => {
    sql += `-- Function: ${func.function_name}\n`;
    sql += func.definition + '\n\n';
  });

  // Tables and their components
  (schemaInfo.tables || []).forEach(table => {
    sql += `-- Table: ${table.table_name}\n`;
    sql += 'CREATE TABLE IF NOT EXISTS ' + table.table_name + ' (\n';
    
    // Columns
    const columnDefs = (table.columns || []).map(col => {
      let def = `  ${col.column_name} ${col.data_type}`;
      if (col.is_nullable === 'NO') def += ' NOT NULL';
      if (col.column_default) def += ` DEFAULT ${col.column_default}`;
      return def;
    });
    
    sql += columnDefs.join(',\n');
    sql += '\n);\n\n';

    // Constraints
    const constraints = table.constraints || [];
    if (constraints.length > 0) {
      sql += '-- Constraints\n';
      constraints.forEach(constraint => {
        if (!constraint.definition.startsWith('PRIMARY KEY')) {
          sql += `ALTER TABLE ${table.table_name} ADD CONSTRAINT ${constraint.constraint_name} ${constraint.definition};\n`;
        }
      });
      sql += '\n';
    }

    // Indexes
    const indexes = table.indexes || [];
    if (indexes.length > 0) {
      sql += '-- Indexes\n';
      indexes.forEach(idx => {
        sql += idx.indexdef + ';\n';
      });
      sql += '\n';
    }

    // Triggers
    const triggers = table.triggers || [];
    if (triggers.length > 0) {
      sql += '-- Triggers\n';
      triggers.forEach(trigger => {
        sql += `CREATE TRIGGER ${trigger.trigger_name}\n`;
        sql += `  ${trigger.action_timing} ${trigger.event_manipulation}\n`;
        sql += `  ON ${table.table_name}\n`;
        sql += `  ${trigger.action_statement};\n\n`;
      });
    }

    // RLS Policies
    const policies = table.policies || [];
    if (policies.length > 0) {
      sql += '-- Row Level Security Policies\n';
      sql += `ALTER TABLE ${table.table_name} ENABLE ROW LEVEL SECURITY;\n`;
      policies.forEach(policy => {
        sql += `CREATE POLICY "${policy.policyname}" ON ${table.table_name}\n`;
        sql += `  FOR ${policy.command}\n`;
        sql += `  TO ${(policy.roles || []).join(', ')}\n`;
        if (policy.using) sql += `  USING (${policy.using})\n`;
        if (policy.with_check) sql += `  WITH CHECK (${policy.with_check})\n`;
        sql += ';\n';
      });
      sql += '\n';
    }
  });

  return sql;
}

async function fetchSchema() {
  try {
    console.log('Fetching schema information...');
    
    const schemaInfo = await fetchDatabaseInfo();
    console.log('Schema info fetched:', {
      tables: schemaInfo.tables?.length || 0,
      functions: schemaInfo.functions?.length || 0
    });

    // Get absolute paths
    const rootDir = path.resolve(__dirname, '..');
    const docsDir = path.join(rootDir, 'Documentations');
    console.log('Writing to directory:', docsDir);

    // Create directory if it doesn't exist
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    // Write JSON file
    const jsonPath = path.join(docsDir, 'schema_info.json');
    const jsonContent = JSON.stringify(schemaInfo, null, 2);
    try {
      fs.writeFileSync(jsonPath, jsonContent);
      const jsonSize = fs.statSync(jsonPath).size;
      console.log(`✓ schema_info.json written (${jsonSize} bytes)`);
    } catch (err) {
      console.error('Failed to write schema_info.json:', err);
      throw err;
    }

    // Write Markdown file
    const mdPath = path.join(docsDir, 'schema_docs.md');
    const markdown = generateMarkdown(schemaInfo);
    try {
      fs.writeFileSync(mdPath, markdown);
      const mdSize = fs.statSync(mdPath).size;
      console.log(`✓ schema_docs.md written (${mdSize} bytes)`);
    } catch (err) {
      console.error('Failed to write schema_docs.md:', err);
      throw err;
    }

    // Write SQL file
    const sqlPath = path.join(docsDir, 'schema.sql');
    const sqlContent = generateSQL(schemaInfo);
    try {
      fs.writeFileSync(sqlPath, sqlContent);
      const sqlSize = fs.statSync(sqlPath).size;
      console.log(`✓ schema.sql written (${sqlSize} bytes)`);
    } catch (err) {
      console.error('Failed to write schema.sql:', err);
      throw err;
    }

    console.log('\nSchema files created successfully');
  } catch (error) {
    console.error('Error in fetchSchema:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

// Execute the function
fetchSchema()
  .then(() => {
    console.log('Schema fetch completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to fetch schema:', error);
    process.exit(1);
  }); 