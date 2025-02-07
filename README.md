# Web Accessibility MCP Server

An MCP (Model Context Protocol) server that provides web accessibility analysis capabilities using axe-core and Puppeteer.

## Features

- Analyze web accessibility of any URL using axe-core
- Detailed reporting of accessibility violations
- Support for custom user agents and selectors
- Debug logging for troubleshooting
- Comprehensive accessibility checks based on WCAG guidelines

## Prerequisites

- Node.js (v14 or higher)
- npm

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd mcp-web-a11y
```

2. Install dependencies:
```bash
npm install
```

3. Build the server:
```bash
npm run build
```

## Configuration

Add the server to your MCP settings file (typically located at `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "web-a11y": {
      "command": "node",
      "args": ["/path/to/mcp-web-a11y/build/index.js"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Usage

The server provides a single tool called `analyze_url` that can be used to analyze web accessibility.

### Tool: analyze_url

Analyzes the accessibility of a given URL using axe-core.

#### Parameters

- `url` (required): The URL to analyze
- `waitForSelector` (optional): CSS selector to wait for before analysis
- `userAgent` (optional): Custom user agent string for the request

#### Example Usage

```typescript
<use_mcp_tool>
<server_name>mcp-web-a11y</server_name>
<tool_name>analyze_url</tool_name>
<arguments>
{
  "url": "https://example.com",
  "waitForSelector": ".main-content",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
</arguments>
</use_mcp_tool>
```

### Response Format

The tool returns a JSON response with the following structure:

```json
{
  "url": "analyzed-url",
  "timestamp": "ISO-timestamp",
  "violations": [
    {
      "impact": "serious|critical|moderate|minor",
      "description": "Description of the violation",
      "help": "Help text explaining the issue",
      "helpUrl": "URL to detailed documentation",
      "nodes": [
        {
          "html": "HTML of the affected element",
          "failureSummary": "Summary of what needs to be fixed"
        }
      ]
    }
  ],
  "passes": 42,
  "inapplicable": 45,
  "incomplete": 3
}
```

### Error Handling

The server includes comprehensive error handling for common scenarios:

- Network errors
- Invalid URLs
- Timeout issues
- DNS resolution problems

Error responses will include detailed messages to help diagnose the issue.

## Development

### Project Structure

```
mcp-web-a11y/
├── src/
│   └── index.ts    # Main server implementation
├── build/          # Compiled JavaScript
├── package.json    # Project dependencies and scripts
└── tsconfig.json   # TypeScript configuration
```

### Building

```bash
npm run build
```

This will:
1. Compile TypeScript to JavaScript
2. Make the output file executable
3. Place the compiled files in the `build` directory

### Debugging

The server includes detailed debug logging that can be observed in the console output. This includes:
- Network requests and responses
- Page loading status
- Selector waiting status
- Any console messages from the analyzed page

## Common Issues and Solutions

1. **Timeout Errors**
   - Increase the timeout value in the code
   - Check network connectivity
   - Verify the URL is accessible

2. **DNS Resolution Errors**
   - Verify the URL is correct
   - Check network connectivity
   - Try using the www subdomain

3. **Selector Not Found**
   - Verify the selector exists on the page
   - Wait for dynamic content to load
   - Check the page source for the correct selector

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
