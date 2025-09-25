import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import postgres from 'postgres';
import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";
// Enhanced logging utility
const log = {
    info: (message, data) => {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [INFO] ${message}`;
        console.error(logMessage);
        if (data) {
            console.error(JSON.stringify(data, null, 2));
        }
    },
    error: (message, error) => {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [ERROR] ${message}`;
        console.error(logMessage);
        if (error) {
            console.error('Error details:', error instanceof Error ? error.stack : JSON.stringify(error, null, 2));
        }
    },
    warn: (message, data) => {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [WARN] ${message}`;
        console.error(logMessage);
        if (data) {
            console.error(JSON.stringify(data, null, 2));
        }
    }
};
let dbConnection = null;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Validate environment variables
const validateEnvironment = () => {
    log.info("Validating environment variables...");
    const requiredVars = ['DB_HOST', 'DB_NAME', 'DB_USERNAME', 'DB_PASSWORD'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        const error = `Missing required environment variables: ${missingVars.join(', ')}`;
        log.error("Environment validation failed", { missingVars, availableVars: Object.keys(process.env) });
        throw new Error(error);
    }
    // Validate port if provided
    if (process.env.DB_PORT) {
        const port = parseInt(process.env.DB_PORT);
        if (isNaN(port) || port < 1 || port > 65535) {
            const error = `Invalid DB_PORT: ${process.env.DB_PORT}. Must be a number between 1 and 65535.`;
            log.error("Environment validation failed", { invalidPort: process.env.DB_PORT });
            throw new Error(error);
        }
    }
    log.info("Environment validation successful", {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || '5432',
        database: process.env.DB_NAME,
        username: process.env.DB_USERNAME,
        passwordSet: !!process.env.DB_PASSWORD
    });
};
const server = new McpServer({
    name: "postgres-connector",
    version: "1.0.0"
});
// Helper to create DB connection
const getDb = () => {
    log.info("Creating database connection...");
    try {
        const config = {
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME,
            username: process.env.DB_USERNAME,
            password: '***hidden***',
            ssl: true
        };
        log.info("Database configuration", config);
        const db = postgres({
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME,
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            ssl: true,
            onnotice: (notice) => {
                log.info("PostgreSQL notice", notice);
            },
            onparameter: (key, value) => {
                log.info("PostgreSQL parameter", { key, value: key === 'password' ? '***hidden***' : value });
            }
        });
        log.info("Database connection object created successfully");
        return db;
    }
    catch (error) {
        log.error("Failed to create database connection", error);
        throw error;
    }
};
// Helper to test the database connection
const testDB = async (db) => {
    log.info("Testing database connection...");
    try {
        // Simple query to test connection
        log.info("Executing test query: SELECT 1 as test");
        const result = await db `SELECT 1 as test`;
        log.info("Database connection test successful", result);
        return { success: true, message: "Connection successful", result };
    }
    catch (error) {
        log.error("Database connection test failed", error);
        return {
            success: false,
            message: "Connection failed",
            error: error instanceof Error ? error.message : String(error)
        };
    }
};
// Helper to initialize the database connection
const initDb = () => {
    if (!dbConnection) {
        log.info("Initializing new database connection...");
        dbConnection = getDb();
    }
    else {
        log.info("Using existing database connection");
    }
    return dbConnection;
};
function sqlValidation(sql) {
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
server.registerTool("test-postgres-connection", {
    title: "Test Postgres Connection",
    description: "Test the Postgres connection and return connection status",
}, async () => {
    log.info("Tool 'test-postgres-connection' called");
    try {
        // Show current configuration (without password)
        const config = {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || '5432',
            database: process.env.DB_NAME,
            username: process.env.DB_USERNAME,
            password: '***hidden***'
        };
        log.info("Testing connection with config", config);
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
        }
        else {
            return {
                content: [{
                        type: "text",
                        text: `❌ Database connection failed!\n\nConfiguration:\n${JSON.stringify(config, null, 2)}\n\nError: ${testResult.error}`
                    }],
                isError: true
            };
        }
    }
    catch (error) {
        return {
            content: [{
                    type: "text",
                    text: `❌ Unexpected error during connection test: ${error instanceof Error ? error.message : String(error)}`
                }],
            isError: true
        };
    }
});
// Tool to get all tables in the database
server.registerTool("get-all-tables", {
    title: "Get All Tables Query",
    description: "Execute SQL queries to get all tables in the database",
}, async () => {
    log.info("Tool 'get-all-tables' called");
    const sql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'";
    log.info("Executing SQL query", { sql });
    try {
        const results = await initDb().unsafe(sql);
        log.info("Query executed successfully", { resultCount: results.length });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(results, null, 2)
                }]
        };
    }
    catch (err) {
        const error = err;
        log.error("Query execution failed", error);
        return {
            content: [{
                    type: "text",
                    text: `Error: ${error.message}`
                }],
            isError: true
        };
    }
});
//Tool to execute SQL queries (renamed for clarity)
server.registerTool("execute-sql-query", {
    title: "Execute SQL Query",
    description: "Execute a SQL query on the database. Only SELECT statements are allowed for security.",
    inputSchema: {
        sql: z.string().describe("The SQL query to execute")
    },
}, async ({ sql }) => {
    log.info("Tool 'execute-sql-query' called", { sql });
    const validation = sqlValidation(sql);
    if (!validation.success) {
        log.warn("SQL validation failed", { sql, reason: validation.message });
        return {
            content: [{
                    type: "text",
                    text: `❌ Query validation failed: ${validation.message}`
                }],
            isError: true
        };
    }
    log.info("SQL validation passed, executing query");
    try {
        const results = await initDb().unsafe(sql);
        log.info("Query executed successfully", { resultCount: results.length });
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(results, null, 2)
                }]
        };
    }
    catch (err) {
        const error = err;
        log.error("Query execution failed", { sql, error });
        return {
            content: [{
                    type: "text",
                    text: `❌ Query execution failed: ${error.message}`
                }],
            isError: true
        };
    }
});
// Add process exit handlers for graceful shutdown
const setupProcessHandlers = () => {
    process.on('SIGINT', () => {
        log.info("Received SIGINT, shutting down gracefully...");
        if (dbConnection) {
            dbConnection.end().then(() => {
                log.info("Database connection closed");
                process.exit(0);
            }).catch((error) => {
                log.error("Error closing database connection", error);
                process.exit(1);
            });
        }
        else {
            process.exit(0);
        }
    });
    process.on('SIGTERM', () => {
        log.info("Received SIGTERM, shutting down gracefully...");
        if (dbConnection) {
            dbConnection.end().then(() => {
                log.info("Database connection closed");
                process.exit(0);
            }).catch((error) => {
                log.error("Error closing database connection", error);
                process.exit(1);
            });
        }
        else {
            process.exit(0);
        }
    });
    process.on('uncaughtException', (error) => {
        log.error("Uncaught exception", error);
        process.exit(1);
    });
    process.on('unhandledRejection', (reason, promise) => {
        log.error("Unhandled rejection", { reason, promise });
        process.exit(1);
    });
};
async function main() {
    log.info("Starting Postgres Connector MCP Server...");
    try {
        // Validate environment before starting
        validateEnvironment();
        // Setup process handlers
        setupProcessHandlers();
        // Create transport
        log.info("Creating stdio transport...");
        const transport = new StdioServerTransport();
        // Connect to server
        log.info("Connecting to MCP server...");
        await server.connect(transport);
        log.info("MCP server started successfully and connected to transport");
        // Test database connection on startup
        log.info("Testing initial database connection...");
        const db = initDb();
        const testResult = await testDB(db);
        if (testResult.success) {
            log.info("Initial database connection test passed");
        }
        else {
            log.warn("Initial database connection test failed", testResult);
        }
    }
    catch (error) {
        log.error("Failed to start MCP server", error);
        process.stderr.write(`Failed to start MCP server: ${error instanceof Error ? error.message : String(error)}\n`);
        process.exit(1);
    }
}
main().catch(error => {
    log.error("Unexpected error in main", error);
    process.stderr.write(`Unexpected error in main: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
});
//# sourceMappingURL=server.js.map