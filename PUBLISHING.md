# Publishing to MCP Registry

This document outlines how to publish the PostgreSQL MCP server to the Model Context Protocol registry.

## Setup Complete! 🎉

The following files have been created/updated for automated MCP registry publishing:

- `server.json` - MCP registry configuration
- `.github/workflows/publish-mcp.yml` - GitHub Actions workflow for automated publishing
- `package.json` - Updated with NPM publishing configuration
- `validate-server.js` - Custom validation script

## Required Secrets

Before publishing, you need to set up the following secrets in your GitHub repository:

### 1. NPM Token
1. Go to [npmjs.com](https://npmjs.com) and create an account if you don't have one
2. Generate an access token: Profile → Access Tokens → Generate New Token
3. Choose "Automation" type for CI/CD
4. Add the token to GitHub Secrets as `NPM_TOKEN`:
   - Go to your repository on GitHub
   - Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Your NPM token

## Publishing Process

### Automated Publishing (Recommended)
1. **Create and push a version tag**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **GitHub Actions will automatically**:
   - Validate the server.json configuration
   - Publish the package to NPM
   - Publish the server to the MCP registry using GitHub OIDC authentication

### Manual Publishing (Fallback)
If the automated process fails, you can publish manually:

1. **Install MCP Publisher CLI**:
   ```bash
   npm install -g @modelcontextprotocol/mcp-publisher
   ```

2. **Login using GitHub**:
   ```bash
   mcp-publisher login github --token YOUR_GITHUB_TOKEN
   ```

3. **Publish to NPM** (if not done automatically):
   ```bash
   npm publish
   ```

4. **Publish to MCP Registry**:
   ```bash
   mcp-publisher publish
   ```

## Troubleshooting

### Common Issues

1. **NPM_TOKEN not working**: Make sure the token has "Automation" scope and is correctly added to GitHub Secrets

2. **Package name conflicts**: The package name `postgres-connector` might be taken. If so, update both `package.json` and `server.json` with a unique name like `postgres-connector-mcp`

3. **GitHub OIDC authentication fails**: Ensure your repository has the correct permissions set in the workflow file

4. **Validation fails**: Run `npm run validate` locally to check for configuration issues

### Manual Verification
You can test the configuration locally:
```bash
npm run validate
```

## Next Steps

1. Set up the NPM_TOKEN secret in GitHub
2. Push your changes to GitHub
3. Create and push a version tag to trigger the publishing workflow
4. Monitor the Actions tab in GitHub for the publishing progress

## Configuration Files

- **server.json**: Contains MCP registry metadata including namespace, version, and deployment configuration
- **GitHub Actions workflow**: Automates the entire publishing process on version tags
- **package.json**: Updated with proper NPM publishing configuration

The server is configured to use the `io.github.martymarkenson/postgres-connector` namespace, which allows authentication via GitHub OIDC without requiring custom domain verification.