import { promises as fs } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BrowserContext, Page } from '@playwright/test';

export interface SessionData {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  storage: Record<string, string>;
  lastUpdated: number;
}

export class SessionManager {
  private static readonly SESSION_FILE = path.join(
    process.cwd(),
    'test-results',
    'e2e-session.json'
  );

  static async saveSession(context: BrowserContext): Promise<void> {
    console.log('💾 Saving session data...');

    const cookies = await context.cookies();

    // Create a temporary page to access localStorage
    const pages = context.pages();
    let page: Page;

    if (pages.length > 0) {
      page = pages[0];
    } else {
      page = await context.newPage();
    }

    const storage = await page.evaluate(() => {
      const storage: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          storage[key] = localStorage.getItem(key) || '';
        }
      }
      return storage;
    });

    const sessionData: SessionData = {
      cookies,
      storage,
      lastUpdated: Date.now(),
    };

    // Ensure directory exists
    await fs.mkdir(path.dirname(this.SESSION_FILE), { recursive: true });

    // Write session data
    await fs.writeFile(this.SESSION_FILE, JSON.stringify(sessionData, null, 2));

    console.log('✅ Session data saved');
  }

  static async loadSession(context: BrowserContext): Promise<boolean> {
    console.log('📥 Loading session data...');

    try {
      const sessionData = await fs.readFile(this.SESSION_FILE, 'utf-8');
      const session: SessionData = JSON.parse(sessionData);

      // Check if session is recent (less than 1 hour old)
      const oneHour = 60 * 60 * 1000;
      if (Date.now() - session.lastUpdated > oneHour) {
        console.log('⚠️ Session data is expired');
        return false;
      }

      // Restore cookies
      await context.addCookies(session.cookies);

      // Restore localStorage
      await context.addInitScript(storage => {
        Object.entries(storage).forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });
      }, session.storage);

      console.log('✅ Session data loaded');
      return true;
    } catch (error) {
      console.log('⚠️ No session data found or invalid format');
      return false;
    }
  }

  static async clearSession(): Promise<void> {
    console.log('🗑️ Clearing session data...');

    try {
      await fs.unlink(this.SESSION_FILE);
      console.log('✅ Session data cleared');
    } catch (error) {
      // File might not exist, which is fine
      console.log('ℹ️ No session data to clear');
    }

    // Also try to clear any browser storage files that might interfere
    try {
      const execAsync = promisify(exec);

      // Clear any browser state files that might contain corrupted auth data
      await execAsync('rm -rf test-results/*session* 2>/dev/null || true');
      await execAsync(
        'rm -rf test-results/.playwright-artifacts*/**/*session* 2>/dev/null || true'
      );

      console.log('✅ Cleared browser session artifacts');
    } catch (error) {
      console.log('⚠️ Could not clear browser session artifacts');
    }
  }

  static async validateSession(page: Page): Promise<boolean> {
    try {
      // Navigate to dashboard instead of API endpoint to check if session is valid
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 5000 });

      // Wait a moment for the page to load
      await page.waitForTimeout(1000);

      // Check if we're on a protected page (not login or setup)
      const currentUrl = page.url();

      // If we're on login, setup, or access denied, session is invalid
      if (
        currentUrl.includes('/login') ||
        currentUrl.includes('/setup') ||
        currentUrl.includes('/access-denied')
      ) {
        return false;
      }

      // If we're on dashboard or home page, session is valid
      if (currentUrl.endsWith('/') || currentUrl.includes('/dashboard')) {
        console.log('✅ Session validated - user is logged in');
        return true;
      }

      // Additional check: look for authenticated elements
      const authIndicators = [
        'text=Logout',
        'text=Profile',
        'text=Jobs',
        'text=Users',
        'text=Dicts',
        'text=Networks',
      ];

      for (const indicator of authIndicators) {
        try {
          const element = page.locator(indicator).first();
          if (await element.isVisible({ timeout: 1000 })) {
            console.log(
              '✅ Session validated - found authenticated UI elements'
            );
            return true;
          }
        } catch (error) {
          // Continue to next indicator
        }
      }

      console.log('⚠️ Session validation inconclusive');
      return false;
    } catch (error) {
      console.log('❌ Session validation failed:', error);
      return false;
    }
  }
}
