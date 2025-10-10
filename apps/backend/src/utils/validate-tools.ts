import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ToolValidationResult {
  installed: boolean;
  version?: string;
  error?: string;
}

/**
 * Check if a command-line tool is installed and accessible
 */
async function checkTool(command: string, versionFlag: string = '--version'): Promise<ToolValidationResult> {
  try {
    const { stdout, stderr } = await execAsync(`${command} ${versionFlag}`, {
      timeout: 5000
    });

    const output = stdout || stderr;
    const versionMatch = output.match(/\d+\.\d+(\.\d+)?/);

    return {
      installed: true,
      version: versionMatch ? versionMatch[0] : 'unknown'
    };
  } catch (error) {
    return {
      installed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Validate that all required tools for AutoPWN are installed
 * @throws Error if any required tools are missing
 */
export async function validateRequiredTools(): Promise<void> {
  console.log('🔍 Validating required tools...');

  const requiredTools = [
    { name: 'hashcat', command: 'hashcat', flag: '--version' },
    { name: 'hcxpcapngtool', command: 'hcxpcapngtool', flag: '--version' }
  ];

  const results: { [key: string]: ToolValidationResult } = {};
  const missing: string[] = [];

  for (const tool of requiredTools) {
    const result = await checkTool(tool.command, tool.flag);
    results[tool.name] = result;

    if (result.installed) {
      console.log(`  ✅ ${tool.name}: v${result.version}`);
    } else {
      console.error(`  ❌ ${tool.name}: NOT FOUND`);
      missing.push(tool.name);
    }
  }

  if (missing.length > 0) {
    const errorMessage = `
❌ Missing required tools: ${missing.join(', ')}

AutoPWN requires the following tools to be installed:
${missing.map(tool => `  - ${tool}`).join('\n')}

Installation instructions:
  • hashcat: https://hashcat.net/hashcat/
  • hcxpcapngtool: https://github.com/ZerBea/hcxtools

For Docker users: These tools are included in the Docker image.
For local development: Install these tools manually on your system.
`;
    throw new Error(errorMessage);
  }

  console.log('✅ All required tools are installed\n');
}
