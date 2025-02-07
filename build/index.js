#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import puppeteer from 'puppeteer';
import axe from 'axe-core';
class WebA11yServer {
    constructor() {
        this.server = new Server({
            name: 'web-a11y-server',
            version: '0.1.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'analyze_url',
                    description: 'Analyze web accessibility of a given URL using axe-core',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            url: {
                                type: 'string',
                                description: 'URL to analyze',
                            },
                            waitForSelector: {
                                type: 'string',
                                description: 'Optional CSS selector to wait for before analysis',
                            },
                            userAgent: {
                                type: 'string',
                                description: 'Optional user agent string to use for the request',
                            },
                        },
                        required: ['url'],
                    },
                },
            ],
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (request.params.name !== 'analyze_url') {
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
            }
            if (!request.params.arguments || typeof request.params.arguments.url !== 'string') {
                throw new McpError(ErrorCode.InvalidParams, 'URL parameter is required');
            }
            const args = {
                url: request.params.arguments.url,
                waitForSelector: typeof request.params.arguments.waitForSelector === 'string'
                    ? request.params.arguments.waitForSelector
                    : undefined,
                userAgent: typeof request.params.arguments.userAgent === 'string'
                    ? request.params.arguments.userAgent
                    : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            };
            try {
                const browser = await puppeteer.launch({
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gpu',
                        '--window-size=1920,1080',
                        '--dns-prefetch-disable'
                    ]
                });
                const page = await browser.newPage();
                await page.setViewport({ width: 1920, height: 1080 });
                await page.setUserAgent(args.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                // Enable request interception for debugging
                await page.setRequestInterception(true);
                page.on('request', request => {
                    console.error(`[Debug] Request: ${request.url()}`);
                    request.continue();
                });
                page.on('response', response => {
                    console.error(`[Debug] Response: ${response.url()} - ${response.status()}`);
                });
                page.on('console', msg => {
                    console.error(`[Page Console] ${msg.text()}`);
                });
                console.error(`[Debug] Navigating to ${args.url}`);
                // Add www subdomain if not present and ensure https
                const urlToUse = args.url.replace(/^(https?:\/\/)?(www\.)?/, 'https://www.');
                console.error(`[Debug] Modified URL: ${urlToUse}`);
                const response = await page.goto(urlToUse, {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000
                });
                console.error(`[Debug] Page loaded with status: ${response?.status()}`);
                // Wait for any element to be present rather than a specific selector
                await page.waitForSelector('body', { timeout: 30000 });
                // Brief pause to let dynamic content load
                await new Promise(resolve => setTimeout(resolve, 5000));
                // Inject and run axe-core
                await page.evaluate(axe.source);
                const results = await page.evaluate(() => {
                    return new Promise((resolve) => {
                        // @ts-ignore
                        window.axe.run((err, results) => {
                            if (err) {
                                resolve({ error: err });
                            }
                            resolve(results);
                        });
                    });
                });
                await browser.close();
                if ('error' in results) {
                    throw new Error(String(results.error));
                }
                // Format results
                const violations = results.violations.map(violation => ({
                    impact: violation.impact,
                    description: violation.description,
                    help: violation.help,
                    helpUrl: violation.helpUrl,
                    nodes: violation.nodes.map((node) => ({
                        html: node.html,
                        failureSummary: node.failureSummary,
                    })),
                }));
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                url: args.url,
                                timestamp: new Date().toISOString(),
                                violations,
                                passes: results.passes.length,
                                inapplicable: results.inapplicable.length,
                                incomplete: results.incomplete.length,
                            }, null, 2),
                        },
                    ],
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error analyzing URL: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Web Accessibility MCP server running on stdio');
    }
}
const server = new WebA11yServer();
server.run().catch(console.error);
