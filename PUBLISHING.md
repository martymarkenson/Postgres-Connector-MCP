# Publishing to MCP Registry

This document outlines how to publish the PostgreSQL MCP server to the Model Context Protocol registry.

## Publishing Process

### Step 1: Install MCP Publisher CLI

**⚠️ Important**: The Homebrew version has known issues. Build from source for best results:

```bash
# Install Go (required for building)
brew install go

# Clone and build latest version
cd ..  # Navigate outside your project directory
git clone https://github.com/modelcontextprotocol/registry
cd registry
make publisher

# Use the built version
cd ../your-project-directory
../registry/bin/mcp-publisher --version
```

Alternative (may have issues):
```bash
brew install mcp-publisher  # Older version with known bugs
```

### Step 2: Update package.json
Add the required `mcpName` field to your `package.json`:
```json
{
  "name": "postgres-connector",
  "version": "1.0.0",
  "mcpName": "io.github.martymarkenson/postgres-connector"
}
```

### Step 3: Configure server.json
Create/update `server.json` with the correct format (note the required `transport` field):
```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-09-16/server.schema.json",
  "name": "io.github.martymarkenson/postgres-connector",
  "description": "MCP server for querying PostgreSQL databases",
  "version": "1.0.0",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "postgres-connector",
      "version": "1.0.0",
      "transport": {
        "type": "stdio"
      }
    }
  ]
}
```

### Step 4: Authenticate and Publish
```bash
# Login to NPM (one-time setup)
npm login  # Follow browser authentication

# Publish to NPM
npm publish

# Login to MCP registry (one-time setup)
../registry/bin/mcp-publisher login github  # Follow browser authentication

# Publish to MCP registry
../registry/bin/mcp-publisher publish
```

## Final Results ✅

### Successfully Published
1. ✅ **NPM Package**: Available at https://www.npmjs.com/package/postgres-connector
2. ✅ **MCP Registry**: Listed as `io.github.martymarkenson/postgres-connector`
3. ✅ **Server ID**: `5fe9408b-2370-41fb-90f9-3fce961c0968`
4. ✅ **Discoverable**: Searchable in the MCP registry

### Solution to Publishing Issues
The Homebrew version of `mcp-publisher` had schema compatibility issues. **Building from source resolved all problems** and enabled successful publication to the MCP registry.

### Verification
You can verify the publication:
```bash
curl "https://registry.modelcontextprotocol.io/v0/servers?search=postgres-connector"
```

## Using the NPM Package

Even without MCP registry publication, your package is available for direct use:

```bash
npm install postgres-connector
npx postgres-connector
```

Or in Claude Desktop configuration:
```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["postgres-connector"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://user:password@host:port/database"
      }
    }
  }
}
```

## Updating Your Published Server

### How Updates Work
- **NPM and MCP registry are separate** - updating one doesn't automatically update the other
- **Version increments are mandatory** - you cannot republish the same version number
- **Manual process required** for each update

### Update Workflow
1. **Make your changes** to the code/documentation
2. **Update version numbers** in both files:
   ```bash
   npm version patch  # Updates package.json automatically
   # Manually update version in server.json to match
   ```
3. **Publish to NPM**:
   ```bash
   npm publish
   ```
4. **Republish to MCP registry**:
   ```bash
   ../registry/bin/mcp-publisher publish
   ```

### Important Notes
- ⚠️ **Both versions must match** - keep `package.json` and `server.json` versions synchronized
- ⚠️ **Cannot skip versions** - each publish requires a unique version number
- ⚠️ **Authentication expires** - you may need to re-login: `../registry/bin/mcp-publisher login github`