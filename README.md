# Web Accessibility MCP Server

[![smithery badge](https://smithery.ai/badge/@bilhasry-deriv/mcp-web-a11y)](https://smithery.ai/server/@bilhasry-deriv/mcp-web-a11y)

An MCP (Model Context Protocol) server that provides web accessibility analysis capabilities using axe-core and Puppeteer.

## Features

- Analyze web accessibility of any URL using axe-core
- Simulate color blindness (protanopia, deuteranopia, tritanopia) using color matrices
- Detailed reporting of accessibility violations
- Support for custom user agents and selectors
- Debug logging for troubleshooting
- Comprehensive accessibility checks based on WCAG guidelines

## Prerequisites

- Node.js (v14 or higher)
- npm

## Installation

### Installing via Smithery

To install Web Accessibility MCP Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@bilhasry-deriv/mcp-web-a11y):

```bash
npx -y @smithery/cli install @bilhasry-deriv/mcp-web-a11y --client claude
```

### Manual Installation
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

The server provides two tools: `check_accessibility` for analyzing web accessibility and `simulate_colorblind` for simulating color blindness.

### Tool: check_accessibility

Checks the accessibility of a given URL using axe-core.

#### Parameters

- `url` (required): The URL to analyze
- `waitForSelector` (optional): CSS selector to wait for before analysis
- `userAgent` (optional): Custom user agent string for the request

#### Example Usage

```typescript
<use_mcp_tool>
<server_name>mcp-web-a11y</server_name>
<tool_name>check_accessibility</tool_name>
<arguments>
{
  "url": "https://example.com",
  "waitForSelector": ".main-content",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
</arguments>
</use_mcp_tool>
```

### Tool: simulate_colorblind

Simulates how a webpage appears to users with different types of color blindness using color matrix transformations.

#### Color Blindness Types

The tool supports three types of color blindness simulation:

1. **Protanopia** (red-blind) - Uses matrix:
   ```
   0.567, 0.433, 0
   0.558, 0.442, 0
   0, 0.242, 0.758
   ```

2. **Deuteranopia** (green-blind) - Uses matrix:
   ```
   0.625, 0.375, 0
   0.7, 0.3, 0
   0, 0.3, 0.7
   ```

3. **Tritanopia** (blue-blind) - Uses matrix:
   ```
   0.95, 0.05, 0
   0, 0.433, 0.567
   0, 0.475, 0.525
   ```

#### Parameters

- `url` (required): The URL to capture
- `type` (required): Type of color blindness to simulate ('protanopia', 'deuteranopia', or 'tritanopia')
- `outputPath` (optional): Custom path for the screenshot output
- `userAgent` (optional): Custom user agent string for the request

#### Example Usage

```typescript
<use_mcp_tool>
<server_name>mcp-web-a11y</server_name>
<tool_name>simulate_colorblind</tool_name>
<arguments>
{
  "url": "https://example.com",
  "type": "deuteranopia",
  "outputPath": "colorblind_simulation.png"
}
</arguments>
</use_mcp_tool>
```

### Response Format

#### check_accessibility Response

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

#### simulate_colorblind Response

```json
{
  "url": "analyzed-url",
  "type": "colorblind-type",
  "outputPath": "path/to/screenshot.png",
  "timestamp": "ISO-timestamp",
  "message": "Screenshot saved with [type] simulation"
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
├── output/         # Generated screenshots
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
- Color simulation progress

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

4. **Color Simulation Issues**
   - Ensure the page's colors are specified in a supported format (RGB, RGBA, or HEX)
   - Check if the page uses dynamic color changes (may require additional wait time)
   - Verify the screenshot output directory exists and is writable

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
