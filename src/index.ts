#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import puppeteer from 'puppeteer';
import axe from 'axe-core';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { simulate } from '@bjornlu/colorblind';

// Extend Window interface to include our simulate function
declare global {
  interface Window {
    simulate: (rgb: RGB, type: string) => RGB;
  }
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

// Helper function to parse color string to RGB
function parseColor(color: string): RGB {
  // Remove all spaces and convert to lowercase
  color = color.toLowerCase().replace(/\s/g, '');
  
  // Handle rgba/rgb format
  if (color.startsWith('rgba(') || color.startsWith('rgb(')) {
    const values = color
      .replace('rgba(', '')
      .replace('rgb(', '')
      .replace(')', '')
      .split(',')
      .map(Number);
    return {
      r: values[0],
      g: values[1],
      b: values[2]
    };
  }
  
  // Handle hex format
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return { r, g, b };
  }
  
  // Default to black if color format is not recognized
  return { r: 0, g: 0, b: 0 };
}

// Helper function to convert RGB to CSS color string
function rgbToString(rgb: RGB): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

interface AnalyzeUrlArgs {
  url: string;
  waitForSelector?: string;
  userAgent?: string;
}

interface SimulateColorblindArgs {
  url: string;
  type: 'protanopia' | 'deuteranopia' | 'tritanopia';
  outputPath?: string;
  userAgent?: string;
}

class WebA11yServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'web-a11y-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'check_accessibility',
          description: 'Check web accessibility of a given URL using axe-core',
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
        {
          name: 'simulate_colorblind',
          description: 'Simulate how a webpage looks for colorblind users',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to capture',
              },
              type: {
                type: 'string',
                enum: ['protanopia', 'deuteranopia', 'tritanopia'],
                description: 'Type of color blindness to simulate',
              },
              outputPath: {
                type: 'string',
                description: 'Optional path to save the screenshot',
              },
              userAgent: {
                type: 'string',
                description: 'Optional user agent string to use for the request',
              },
            },
            required: ['url', 'type'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'check_accessibility') {
        return this.handleAccessibilityCheck(request);
      } else if (request.params.name === 'simulate_colorblind') {
        return this.handleColorBlindSimulation(request);
      } else {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }
    });
  }

  private async handleColorBlindSimulation(request: any) {
    if (!request.params.arguments || 
        typeof request.params.arguments.url !== 'string' ||
        typeof request.params.arguments.type !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'URL and type parameters are required'
      );
    }

    const args: SimulateColorblindArgs = {
      url: request.params.arguments.url,
      type: request.params.arguments.type as 'protanopia' | 'deuteranopia' | 'tritanopia',
      outputPath: request.params.arguments.outputPath,
      userAgent: request.params.arguments.userAgent
    };

    let browser;
    try {
      console.error('[Debug] Launching browser...');
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080'
        ]
      });

      console.error('[Debug] Creating new page...');
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

      console.error('[Debug] Navigating to URL...');
      const urlToUse = args.url.replace(/^(https?:\/\/)?(www\.)?/, 'https://www.');
      console.error(`[Debug] Modified URL: ${urlToUse}`);
      
      const response = await page.goto(urlToUse, { 
        waitUntil: 'networkidle2',
        timeout: 120000 // Increased timeout to 2 minutes
      });
      
      console.error(`[Debug] Page loaded with status: ${response?.status()}`);

      // Wait for the page to be fully loaded
      console.error('[Debug] Waiting for page load...');
      await page.waitForSelector('body', { timeout: 120000 });
      
      // Give extra time for dynamic content
      console.error('[Debug] Waiting for dynamic content...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Inject the colorblind simulation code
      console.error('[Debug] Injecting colorblind simulation...');
      await page.evaluate((type) => {
        // Implementation of colorblind simulation
        function multiply(a: number[], b: number[]): number[] {
          return [
            a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
            a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
            a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
          ];
        }

        const colorBlindnessMatrices = {
          protanopia: [
            0.567, 0.433, 0, 
            0.558, 0.442, 0, 
            0, 0.242, 0.758
          ],
          deuteranopia: [
            0.625, 0.375, 0, 
            0.7, 0.3, 0, 
            0, 0.3, 0.7
          ],
          tritanopia: [
            0.95, 0.05, 0, 
            0, 0.433, 0.567, 
            0, 0.475, 0.525
          ]
        };

        window.simulate = function(rgb: RGB, type: string): RGB {
          const matrix = colorBlindnessMatrices[type as keyof typeof colorBlindnessMatrices];
          const result = multiply([rgb.r / 255, rgb.g / 255, rgb.b / 255], matrix);
          return {
            r: Math.round(result[0] * 255),
            g: Math.round(result[1] * 255),
            b: Math.round(result[2] * 255)
          };
        };
        function parseColor(color: string): RGB {
          color = color.toLowerCase().replace(/\s/g, '');
          if (color.startsWith('rgba(') || color.startsWith('rgb(')) {
            const values = color
              .replace('rgba(', '')
              .replace('rgb(', '')
              .replace(')', '')
              .split(',')
              .map(Number);
            return {
              r: values[0],
              g: values[1],
              b: values[2]
            };
          }
          if (color.startsWith('#')) {
            const hex = color.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            return { r, g, b };
          }
          return { r: 0, g: 0, b: 0 };
        }

        function rgbToString(rgb: RGB): string {
          return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        }

        // Get all elements with background color or color
        const elements = document.querySelectorAll('*');
        elements.forEach(el => {
          const htmlEl = el as HTMLElement;
          const styles = window.getComputedStyle(htmlEl);
          const color = styles.color;
          const backgroundColor = styles.backgroundColor;

          if (color !== 'rgba(0, 0, 0, 0)') {
            const rgbColor = parseColor(color);
            const simulatedColor = window.simulate(rgbColor, type);
            htmlEl.style.color = rgbToString(simulatedColor);
          }
          
          if (backgroundColor !== 'rgba(0, 0, 0, 0)') {
            const rgbBgColor = parseColor(backgroundColor);
            const simulatedBgColor = window.simulate(rgbBgColor, type);
            htmlEl.style.backgroundColor = rgbToString(simulatedBgColor);
          }
        });
      }, args.type);

      // Wait for the filter to be applied
      console.error('[Debug] Waiting for filter to apply...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get output directory from environment variable or use default
      const outputDir = process.env.MCP_OUTPUT_DIR || './output';
      console.error('[Debug] Taking screenshot...');
      const outputPath = join(outputDir, args.outputPath || `colorblind_${args.type}.png`);
      
      await page.screenshot({
        path: outputPath,
        fullPage: true
      });

      console.error('[Debug] Screenshot saved successfully');
      await browser.close();
      console.error('[Debug] Browser closed');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              url: args.url,
              type: args.type,
              outputPath: outputPath,
              timestamp: new Date().toISOString(),
              message: `Screenshot saved with ${args.type} simulation`
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('[Debug] Error occurred:', error);
      if (browser) {
        try {
          await browser.close();
          console.error('[Debug] Browser closed after error');
        } catch (closeError) {
          console.error('[Debug] Error closing browser:', closeError);
        }
      }
      return {
        content: [
          {
            type: 'text',
            text: `Error simulating color blindness: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleAccessibilityCheck(request: any) {
    if (!request.params.arguments || typeof request.params.arguments.url !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'URL parameter is required'
      );
    }

    const args: AnalyzeUrlArgs = {
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
      
      console.error(`[Debug] Navigating to ${args.url}`);
      const urlToUse = args.url.replace(/^(https?:\/\/)?(www\.)?/, 'https://www.');
      console.error(`[Debug] Modified URL: ${urlToUse}`);
      const response = await page.goto(urlToUse, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      console.error(`[Debug] Page loaded with status: ${response?.status()}`);
      
      await page.waitForSelector('body', { timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      await page.evaluate(axe.source);
      const results = await page.evaluate(() => {
        return new Promise((resolve) => {
          // @ts-ignore
          window.axe.run((err: any, results: any) => {
            if (err) {
              resolve({ error: err });
            }
            resolve(results);
          });
        });
      }) as {
        violations: Array<{
          impact: string;
          description: string;
          help: string;
          helpUrl: string;
          nodes: Array<{
            html: string;
            failureSummary: string;
          }>;
        }>;
        passes: unknown[];
        inapplicable: unknown[];
        incomplete: unknown[];
      };

      await browser.close();

      if ('error' in results) {
        throw new Error(String(results.error));
      }

      const violations = results.violations.map(violation => ({
        impact: violation.impact,
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        nodes: violation.nodes.map((node: any) => ({
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
    } catch (error) {
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
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Web Accessibility MCP server running on stdio');
  }
}

const server = new WebA11yServer();
server.run().catch(console.error);
