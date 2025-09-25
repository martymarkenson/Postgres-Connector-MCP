import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import postgres from 'postgres'
import {z} from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

let dbConnection: postgres.Sql | null = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = new McpServer({
  name: "postgres-connector",
  version: "1.0.0"
});

// Helper to create DB connection
const getDb = () => {
  const db = postgres({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
      });
  return db;
};

// Helper to test the database connection
const testDB = async (db: postgres.Sql) => {
  try {
    // Simple query to test connection
    const result = await db`SELECT 1 as test`;
    return { success: true, message: "Connection successful", result };
  } catch (error) {
    return { 
      success: false, 
      message: "Connection failed", 
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// Helper to initialize the database connection
const initDb = () => {
  if(!dbConnection) {
    dbConnection = getDb();
  }
  return dbConnection;
};

function sqlValidation(sql: string) {
  const dangerousKeywords = ["DROP", "DELETE", "TRUNCATE", "ALTER", "CREATE", "INSERT", "UPDATE"];
  
  // check if these keywords appear at the start of statements allows them in column names, comments, etc.
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  
  for (const statement of statements) {
    // Skip empty statements and comments
    if (!statement || statement.startsWith('--') || statement.startsWith('/*')) {
      continue;
    }
    
    // Check if statement starts with a dangerous keyword
    const firstWord = statement.split(/\s+/)[0].toUpperCase();
    if (dangerousKeywords.includes(firstWord)) {
      return {
        success: false,
        message: `Dangerous operation detected: ${firstWord}. Only SELECT statements are allowed.`
      };
    }
  }
  
  return {
    success: true,
    message: "SQL is safe"
  };
}

// Tool to test the database connection
server.registerTool(
  "test-postgres-connection",
  {
    title: "Test Postgres Connection",
    description: "Test the Postgres connection and return connection status",
  },
  async () => {
    try {
      // Show current configuration (without password)
      const config = {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || '5432',
        database: process.env.DB_NAME,
        username: process.env.DB_USERNAME,
        password: '***hidden***'
      };

      // Attempt to connect and test
      const db = initDb();
      const testResult = await testDB(db);
      
      if (testResult.success) {
        return {
          content: [{
            type: "text",
            text: `✅ Database connection successful!\n\nConfiguration:\n${JSON.stringify(config, null, 2)}\n\nConnection test result: ${JSON.stringify(testResult.result, null, 2)}`
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: `❌ Database connection failed!\n\nConfiguration:\n${JSON.stringify(config, null, 2)}\n\nError: ${testResult.error}`
          }],
          isError: true
        };
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Unexpected error during connection test: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool to get all tables in the database
server.registerTool(
  "get-all-tables",
  {
    title: "Get All Tables Query",
    description: "Execute SQL queries to get all tables in the database",
  },
  async () => {
    const sql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'";
    try {
      const results = await initDb().unsafe(sql);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(results, null, 2)
        }]
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

//Tool to execute SQL queries (renamed for clarity)
server.registerTool(
  "execute-sql-query",
  {
    title: "Execute SQL Query",
    description: "Execute a SQL query on the database. Only SELECT statements are allowed for security.",
    inputSchema: {
      sql: z.string().describe("The SQL query to execute")
    },
  },
  async ({ sql }) => {
    const validation = sqlValidation(sql);
    if (!validation.success) {
      return {
        content: [{
          type: "text",
          text: `❌ Query validation failed: ${validation.message}`
        }],
        isError: true
      };
    }
    try {
      const results = await initDb().unsafe(sql);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(results, null, 2)
        }]
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        content: [{
          type: "text",
          text: `❌ Query execution failed: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    process.stderr.write(`Failed to start MCP server: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

main().catch(error => {
  process.stderr.write(`Unexpected error in main: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});