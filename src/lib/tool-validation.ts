import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ToolCheckResult {
  name: string;
  available: boolean;
  version?: string;
  error?: string;
  critical: boolean;
}

export class ToolValidator {
  private static instance: ToolValidator;
  private validationResults: Map<string, ToolCheckResult> = new Map();

  private constructor() {}

  static getInstance(): ToolValidator {
    if (!ToolValidator.instance) {
      ToolValidator.instance = new ToolValidator();
    }
    return ToolValidator.instance;
  }

  /**
   * Check if a command-line tool is available and working
   */
  async checkTool(toolName: string, args: string[] = ['--version'], critical: boolean = true): Promise<ToolCheckResult> {
    try {
      console.log(`🔍 Checking availability of ${toolName}...`);

      const { stdout, stderr } = await execAsync(`${toolName} ${args.join(' ')}`, {
        timeout: 10000,
      });

      // Extract version from output
      let version: string | undefined;
      const output = stdout || stderr;

      if (toolName === 'hashcat') {
        const versionMatch = output.match(/v?([\d.]+)/);
        version = versionMatch ? versionMatch[1] : 'Unknown';
      } else if (toolName === 'hcxpcapngtool') {
        const versionMatch = output.match(/v?([\d.]+)/);
        version = versionMatch ? versionMatch[1] : 'Unknown';
      } else {
        // Generic version extraction
        const versionMatch = output.match(/v?([\d.]+)/);
        version = versionMatch ? versionMatch[1] : 'Unknown';
      }

      const result: ToolCheckResult = {
        name: toolName,
        available: true,
        version,
        critical,
      };

      console.log(`✅ ${toolName} is available (version: ${version})`);
      this.validationResults.set(toolName, result);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const result: ToolCheckResult = {
        name: toolName,
        available: false,
        error: errorMessage,
        critical,
      };

      console.error(`❌ ${toolName} is NOT available: ${errorMessage}`);
      this.validationResults.set(toolName, result);
      return result;
    }
  }

  /**
   * Check all required tools for AutoPWN
   */
  async checkRequiredTools(): Promise<ToolCheckResult[]> {
    console.log('🔧 Starting tool validation for AutoPWN...');

    const tools = [
      { name: 'hashcat', args: ['--version'], critical: true },
      { name: 'hcxpcapngtool', args: ['--help'], critical: true },
    ];

    const results = await Promise.all(
      tools.map(tool => this.checkTool(tool.name, tool.args, tool.critical))
    );

    console.log('\n📊 Tool Validation Summary:');
    results.forEach(result => {
      const status = result.available ? '✅' : '❌';
      const version = result.version ? ` (v${result.version})` : '';
      const critical = result.critical ? ' [CRITICAL]' : '';
      console.log(`${status} ${result.name}${version}${critical}`);

      if (!result.available && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    return results;
  }

  /**
   * Get validation result for a specific tool
   */
  getToolResult(toolName: string): ToolCheckResult | undefined {
    return this.validationResults.get(toolName);
  }

  /**
   * Check if all critical tools are available
   */
  areCriticalToolsAvailable(): boolean {
    const results = Array.from(this.validationResults.values());
    return results.filter(r => r.critical && !r.available).length === 0;
  }

  /**
   * Get missing critical tools
   */
  getMissingCriticalTools(): ToolCheckResult[] {
    const results = Array.from(this.validationResults.values());
    return results.filter(r => r.critical && !r.available);
  }

  /**
   * Generate error message for missing tools
   */
  generateMissingToolsError(): string {
    const missingTools = this.getMissingCriticalTools();
    if (missingTools.length === 0) {
      return '';
    }

    const toolList = missingTools.map(t => `- ${t.name}: ${t.error || 'Unknown error'}`).join('\n');
    return `Required tools are missing:\n${toolList}\n\nPlease install the missing tools and restart the application.\n\nFor Docker users, ensure the tools are installed in the Docker image.`;
  }
}

// Export singleton instance
export const toolValidator = ToolValidator.getInstance();