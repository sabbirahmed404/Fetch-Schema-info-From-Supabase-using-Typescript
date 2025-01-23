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

// Import types from fetch-schema.ts
import type { TableInfo, SchemaInfo } from './fetch-schema';

async function fetchSingleTableInfo(tableName: string): Promise<TableInfo | null> {
  try {
    console.log(`Fetching schema information for table: ${tableName}`);
    
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

    if (!data?.tables) {
      console.warn('No tables found in schema info');
      return null;
    }

    const tableInfo = data.tables.find(t => t.table_name === tableName);
    if (!tableInfo) {
      console.warn(`Table '${tableName}' not found in schema`);
      return null;
    }

    return tableInfo;
  } catch (error) {
    console.error('Error fetching table info:', error);
    throw error;
  }
}

function generateSingleTableMarkdown(tableInfo: TableInfo): string {
  let markdown = `# Table: ${tableInfo.table_name}\n\n`;

  // Columns
  markdown += '## Columns\n\n';
  markdown += '| Name | Type | Nullable | Default | Description |\n';
  markdown += '|------|------|----------|----------|-------------|\n';
  (tableInfo.columns || []).forEach(col => {
    markdown += `| ${col.column_name} | ${col.data_type} | ${col.is_nullable} | ${col.column_default || 'NULL'} | ${col.description || '-'} |\n`;
  });
  markdown += '\n';

  // Constraints
  const constraints = tableInfo.constraints || [];
  if (constraints.length > 0) {
    markdown += '## Constraints\n\n';
    markdown += '| Name | Type | Columns | Definition |\n';
    markdown += '|------|------|---------|------------|\n';
    constraints.forEach(constraint => {
      markdown += `| ${constraint.constraint_name} | ${constraint.constraint_type} | ${(constraint.column_names || []).join(', ')} | ${constraint.definition} |\n`;
    });
    markdown += '\n';
  }

  // Foreign Keys
  const foreignKeys = tableInfo.foreign_keys || [];
  if (foreignKeys.length > 0) {
    markdown += '## Foreign Keys\n\n';
    markdown += '| Column | References | Constraint Name |\n';
    markdown += '|--------|------------|----------------|\n';
    foreignKeys.forEach(fk => {
      markdown += `| ${fk.column_name} | ${fk.foreign_table_name}(${fk.foreign_column_name}) | ${fk.constraint_name} |\n`;
    });
    markdown += '\n';
  }

  // Indexes
  const indexes = tableInfo.indexes || [];
  if (indexes.length > 0) {
    markdown += '## Indexes\n\n';
    markdown += '| Name | Definition |\n';
    markdown += '|------|------------|\n';
    indexes.forEach(idx => {
      markdown += `| ${idx.indexname} | ${idx.indexdef} |\n`;
    });
    markdown += '\n';
  }

  // Triggers
  const triggers = tableInfo.triggers || [];
  if (triggers.length > 0) {
    markdown += '## Triggers\n\n';
    triggers.forEach(trigger => {
      markdown += `### ${trigger.trigger_name}\n`;
      markdown += `- Timing: ${trigger.action_timing}\n`;
      markdown += `- Event: ${trigger.event_manipulation}\n`;
      markdown += `- Statement: ${trigger.action_statement}\n`;
      markdown += '```sql\n' + trigger.function_definition + '\n```\n\n';
    });
  }

  // RLS Policies
  const policies = tableInfo.policies || [];
  if (policies.length > 0) {
    markdown += '## Row Level Security Policies\n\n';
    markdown += '| Name | Command | Permissive | Roles | Using | With Check |\n';
    markdown += '|------|---------|------------|-------|-------|------------|\n';
    policies.forEach(policy => {
      markdown += `| ${policy.policyname} | ${policy.command} | ${policy.permissive} | ${(policy.roles || []).join(', ')} | ${policy.using || '-'} | ${policy.with_check || '-'} |\n`;
    });
    markdown += '\n';
  }

  return markdown;
}

function generateSingleTableSQL(tableInfo: TableInfo): string {
  let sql = `-- Table: ${tableInfo.table_name}\n\n`;

  // Create Table
  sql += `CREATE TABLE IF NOT EXISTS ${tableInfo.table_name} (\n`;
  const columnDefs = (tableInfo.columns || []).map(col => {
    let def = `  ${col.column_name} ${col.data_type}`;
    if (col.is_nullable === 'NO') def += ' NOT NULL';
    if (col.column_default) def += ` DEFAULT ${col.column_default}`;
    return def;
  });
  sql += columnDefs.join(',\n');
  sql += '\n);\n\n';

  // Constraints
  const constraints = tableInfo.constraints || [];
  if (constraints.length > 0) {
    sql += '-- Constraints\n';
    constraints.forEach(constraint => {
      if (!constraint.definition.startsWith('PRIMARY KEY')) {
        sql += `ALTER TABLE ${tableInfo.table_name} ADD CONSTRAINT ${constraint.constraint_name} ${constraint.definition};\n`;
      }
    });
    sql += '\n';
  }

  // Indexes
  const indexes = tableInfo.indexes || [];
  if (indexes.length > 0) {
    sql += '-- Indexes\n';
    indexes.forEach(idx => {
      sql += idx.indexdef + ';\n';
    });
    sql += '\n';
  }

  // Triggers
  const triggers = tableInfo.triggers || [];
  if (triggers.length > 0) {
    sql += '-- Triggers\n';
    triggers.forEach(trigger => {
      sql += `CREATE TRIGGER ${trigger.trigger_name}\n`;
      sql += `  ${trigger.action_timing} ${trigger.event_manipulation}\n`;
      sql += `  ON ${tableInfo.table_name}\n`;
      sql += `  ${trigger.action_statement};\n\n`;
    });
  }

  // RLS Policies
  const policies = tableInfo.policies || [];
  if (policies.length > 0) {
    sql += '-- Row Level Security Policies\n';
    sql += `ALTER TABLE ${tableInfo.table_name} ENABLE ROW LEVEL SECURITY;\n`;
    policies.forEach(policy => {
      sql += `CREATE POLICY "${policy.policyname}" ON ${tableInfo.table_name}\n`;
      sql += `  FOR ${policy.command}\n`;
      sql += `  TO ${(policy.roles || []).join(', ')}\n`;
      if (policy.using) sql += `  USING (${policy.using})\n`;
      if (policy.with_check) sql += `  WITH CHECK (${policy.with_check})\n`;
      sql += ';\n';
    });
    sql += '\n';
  }

  return sql;
}

async function fetchSingleTable(tableName: string) {
  try {
    console.log(`Fetching information for table: ${tableName}`);
    
    const tableInfo = await fetchSingleTableInfo(tableName);
    if (!tableInfo) {
      console.error(`Table '${tableName}' not found`);
      return;
    }

    // Get absolute paths
    const rootDir = path.resolve(__dirname, '..');
    const docsDir = path.join(rootDir, 'Documentations', 'tables');
    const tableDir = path.join(docsDir, tableName);
    
    // Create directories if they don't exist
    if (!fs.existsSync(tableDir)) {
      fs.mkdirSync(tableDir, { recursive: true });
    }

    // Write JSON file
    const jsonPath = path.join(tableDir, 'table_info.json');
    const jsonContent = JSON.stringify(tableInfo, null, 2);
    try {
      fs.writeFileSync(jsonPath, jsonContent);
      const jsonSize = fs.statSync(jsonPath).size;
      console.log(`✓ table_info.json written (${jsonSize} bytes)`);
    } catch (err) {
      console.error('Failed to write table_info.json:', err);
      throw err;
    }

    // Write Markdown file
    const mdPath = path.join(tableDir, 'README.md');
    const markdown = generateSingleTableMarkdown(tableInfo);
    try {
      fs.writeFileSync(mdPath, markdown);
      const mdSize = fs.statSync(mdPath).size;
      console.log(`✓ README.md written (${mdSize} bytes)`);
    } catch (err) {
      console.error('Failed to write README.md:', err);
      throw err;
    }

    // Write SQL file
    const sqlPath = path.join(tableDir, 'table.sql');
    const sqlContent = generateSingleTableSQL(tableInfo);
    try {
      fs.writeFileSync(sqlPath, sqlContent);
      const sqlSize = fs.statSync(sqlPath).size;
      console.log(`✓ table.sql written (${sqlSize} bytes)`);
    } catch (err) {
      console.error('Failed to write table.sql:', err);
      throw err;
    }

    console.log(`\nTable documentation created successfully in ${tableDir}`);
  } catch (error) {
    console.error('Error in fetchSingleTable:', error);
    throw error;
  }
}

// Get the table name from command line arguments
const tableName = process.argv[2];

if (!tableName) {
  console.error('Please provide a table name as an argument');
  console.error('Usage: npm run fetch-table <table_name>');
  process.exit(1);
}

// Run the fetch function
fetchSingleTable(tableName)
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to fetch table info:', error);
    process.exit(1);
  });

// Example usage:
// fetchSingleTable('your_table_name');

export { fetchSingleTable }; 
