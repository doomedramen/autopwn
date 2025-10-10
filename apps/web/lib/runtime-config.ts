/**
 * Runtime Configuration Manager
 * Fetches API configuration at runtime instead of build time
 * This enables dynamic configuration for Docker deployments
 */

interface RuntimeConfig {
  apiUrl: string;
  wsUrl?: string;
}

let configCache: RuntimeConfig | null = null;
let configPromise: Promise<RuntimeConfig> | null = null;

/**
 * Fetch runtime configuration from the server
 * Results are cached for the session
 */
export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  // Return cached config if available
  if (configCache) {
    return configCache;
  }

  // Return existing promise if fetch is in progress
  if (configPromise) {
    return configPromise;
  }

  // Start new fetch
  configPromise = (async () => {
    try {
      const response = await fetch('/api/config');
      if (!response.ok) {
        throw new Error(`Config fetch failed: ${response.statusText}`);
      }
      const config = await response.json();
      configCache = config;
      return config;
    } catch (error) {
      console.error('Failed to fetch runtime config, using defaults:', error);
      // Fallback to defaults
      const fallbackConfig: RuntimeConfig = {
        apiUrl: 'http://localhost:3001',
      };
      configCache = fallbackConfig;
      return fallbackConfig;
    } finally {
      configPromise = null;
    }
  })();

  return configPromise;
}

/**
 * Get the API base URL at runtime
 */
export async function getApiUrl(): Promise<string> {
  const config = await getRuntimeConfig();
  return config.apiUrl;
}

/**
 * Get the WebSocket URL at runtime
 */
export async function getWsUrl(): Promise<string> {
  const config = await getRuntimeConfig();
  if (config.wsUrl) {
    return config.wsUrl;
  }
  // Derive WS URL from API URL if not explicitly set
  const apiUrl = config.apiUrl;
  return apiUrl.replace(/^http/, 'ws');
}

/**
 * Clear the config cache (useful for testing)
 */
export function clearConfigCache() {
  configCache = null;
  configPromise = null;
}
