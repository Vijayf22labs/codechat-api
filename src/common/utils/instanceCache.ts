import { logger } from "@/server";

interface CachedInstance {
  name: string;
  authToken?: string;
  connectionStatus: string;
  ownerJid?: string;
  mobileNumber?: string;
  lastUpdated: Date;
  ttl: number; // Time to live in milliseconds
}

export class InstanceCache {
  private static instance: InstanceCache;
  private cache: Map<string, CachedInstance> = new Map();
  private readonly DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes
  private readonly AUTH_TOKEN_TTL = 4 * 60 * 60 * 1000; // 4 hours

  private constructor() {
    // Start cleanup timer
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  public static getInstance(): InstanceCache {
    if (!InstanceCache.instance) {
      InstanceCache.instance = new InstanceCache();
    }
    return InstanceCache.instance;
  }

  /**
   * Cache instance data from webhook events
   */
  public cacheFromWebhook(instanceData: any, authToken?: string): void {
    const mobileNumber = instanceData.ownerJid?.replace("@s.whatsapp.net", "");
    
    const cached: CachedInstance = {
      name: instanceData.name,
      authToken: authToken,
      connectionStatus: instanceData.connectionStatus,
      ownerJid: instanceData.ownerJid,
      mobileNumber: mobileNumber,
      lastUpdated: new Date(),
      ttl: authToken ? this.AUTH_TOKEN_TTL : this.DEFAULT_TTL
    };

    this.cache.set(instanceData.name, cached);
    logger.info(`Cached instance data for ${instanceData.name} via webhook`);
  }

  /**
   * Cache instance data from API polling results
   */
  public cacheFromAPI(instanceData: any): void {
    const mobileNumber = instanceData.ownerJid?.replace("@s.whatsapp.net", "");
    
    const cached: CachedInstance = {
      name: instanceData.name,
      authToken: instanceData.Auth?.token,
      connectionStatus: instanceData.connectionStatus,
      ownerJid: instanceData.ownerJid,
      mobileNumber: mobileNumber,
      lastUpdated: new Date(),
      ttl: this.AUTH_TOKEN_TTL
    };

    this.cache.set(instanceData.name, cached);
    logger.info(`Cached instance data for ${instanceData.name} via API`);
  }

  /**
   * Get cached instance data if valid and not expired
   */
  public getCached(instanceName: string): CachedInstance | null {
    const cached = this.cache.get(instanceName);
    
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() - cached.lastUpdated.getTime() > cached.ttl) {
      this.cache.delete(instanceName);
      logger.warn(`Cache expired for instance ${instanceName}`);
      return null;
    }

    logger.info(`Cache hit for instance ${instanceName}`);
    return cached;
  }

  /**
   * Get auth token from cache
   */
  public getAuthToken(instanceName: string): string | null {
    const cached = this.getCached(instanceName);
    return cached?.authToken || null;
  }

  /**
   * Check if instance is online based on cached data
   */
  public isInstanceOnline(instanceName: string): boolean | null {
    const cached = this.getCached(instanceName);
    if (!cached) return null;
    
    return cached.connectionStatus === "ONLINE";
  }

  /**
   * Get mobile number from cache
   */
  public getMobileNumber(instanceName: string): string | null {
    const cached = this.getCached(instanceName);
    return cached?.mobileNumber || null;
  }

  /**
   * Update connection status from webhook
   */
  public updateConnectionStatus(instanceName: string, status: string): void {
    const cached = this.cache.get(instanceName);
    if (cached) {
      cached.connectionStatus = status;
      cached.lastUpdated = new Date();
      logger.info(`Updated connection status for ${instanceName} to ${status}`);
    }
  }

  /**
   * Update auth token from refreshToken webhook
   */
  public updateAuthToken(instanceName: string, token: string): void {
    const cached = this.cache.get(instanceName);
    if (cached) {
      cached.authToken = token;
      cached.lastUpdated = new Date();
      cached.ttl = this.AUTH_TOKEN_TTL; // Reset TTL for auth tokens
      logger.info(`Updated auth token for ${instanceName}`);
    }
  }

  /**
   * Create mock instance array for backward compatibility
   */
  public createMockInstanceArray(instanceName: string): any[] | null {
    const cached = this.getCached(instanceName);
    if (!cached || !cached.authToken) {
      return null;
    }

    return [{
      name: cached.name,
      connectionStatus: cached.connectionStatus,
      ownerJid: cached.ownerJid,
      Auth: { token: cached.authToken }
    }];
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.lastUpdated.getTime() > cached.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Clear all cache entries (for testing)
   */
  public clearAll(): void {
    this.cache.clear();
    logger.info("Cleared all cache entries");
  }

  /**
   * Clear cache for a specific instance
   */
  public clearInstanceCache(instanceName: string): void {
    this.cache.delete(instanceName);
    logger.info(`Cleared cache for instance: ${instanceName}`);
  }

  /**
   * Get cache statistics
   */
  public getStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }

  //

  /**
   * Get stale status (even if expired) for performance optimization
   */
  public getStaleStatus(instanceName: string): boolean | null {
    const cached = this.cache.get(instanceName);
    if (!cached) return null;
    
    // Return status even if expired (better than no data)
    logger.warn(`Using stale cache data for instance ${instanceName} (expired ${Math.round((Date.now() - cached.lastUpdated.getTime()) / 1000)}s ago)`);
    return cached.connectionStatus === "ONLINE";
  }
}

//