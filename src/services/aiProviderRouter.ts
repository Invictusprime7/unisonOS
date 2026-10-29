/**
 * AI Provider Router - Smart Multi-Provider Routing
 * 
 * Implements intelligent provider selection based on:
 * - Latency measurements from real requests
 * - Cost optimization per provider
 * - Health status and error rates
 * - Fallback strategies
 * 
 * Inspired by OpenClaude smart_router.py and Claude Code provider abstractions.
 */

import type { AIRuntimeResult } from '@/types/aiTerminalIntegration';

export type ProviderType = 'claude' | 'gemini' | 'local' | 'ollama';
export type RoutingStrategy = 'latency' | 'cost' | 'balanced';

interface ProviderMetrics {
  name: ProviderType;
  latencyMs: number;
  costPer1kTokens: number;
  errorRate: number;
  isHealthy: boolean;
  requestCount: number;
  avgLatityMs: number;
}

interface ProviderScore {
  provider: ProviderType;
  score: number;
  reason: string;
}

const PROVIDER_ENV_CHECKS: Record<ProviderType, boolean> = {
  // Hosted providers are invoked by Edge Functions. Browser code only discovers local options.
  claude: false,
  gemini: false,
  local: true,
  ollama: Boolean(import.meta.env.VITE_OLLAMA_BASE_URL),
};

/**
 * Smart router that selects optimal AI provider based on metrics
 */
export class AIProviderRouter {
  private providers: Map<ProviderType, ProviderMetrics> = new Map();
  private strategy: RoutingStrategy = 'balanced';
  private requestHistory: { provider: ProviderType; duration: number; success: boolean }[] = [];

  constructor(strategy: RoutingStrategy = 'balanced') {
    this.strategy = strategy;
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const defaults: Record<ProviderType, Omit<ProviderMetrics, 'isHealthy'>> = {
      claude: { name: 'claude', latencyMs: 800, costPer1kTokens: 0.003, errorRate: 0, requestCount: 0, avgLatityMs: 800 },
      gemini: { name: 'gemini', latencyMs: 700, costPer1kTokens: 0.0005, errorRate: 0, requestCount: 0, avgLatityMs: 700 },
      local: { name: 'local', latencyMs: 100, costPer1kTokens: 0, errorRate: 0, requestCount: 0, avgLatityMs: 100 },
      ollama: { name: 'ollama', latencyMs: 150, costPer1kTokens: 0, errorRate: 0, requestCount: 0, avgLatityMs: 150 },
    };

    Object.entries(defaults).forEach(([key, metrics]) => {
      this.providers.set(key as ProviderType, {
        ...metrics,
        isHealthy: PROVIDER_ENV_CHECKS[key as ProviderType],
      });
    });
  }

  /**
   * Select best provider based on current metrics
   */
  selectProvider(): ProviderType {
    const scores = this.scoreAllProviders();
    if (scores.length === 0) {
      return 'local';
    }
    const best = scores[0];
    if (!Number.isFinite(best.score)) {
      return 'local';
    }
    return best.provider;
  }

  /**
   * Score all providers
   */
  scoreAllProviders(): ProviderScore[] {
    const scores: ProviderScore[] = [];

    this.providers.forEach((metrics, provider) => {
      if (!metrics.isHealthy) {
        scores.push({ provider, score: Infinity, reason: 'Provider unhealthy or not configured' });
        return;
      }

      let score = 0;
      let reason = '';

      switch (this.strategy) {
        case 'latency':
          score = metrics.latencyMs + metrics.errorRate * 5000;
          reason = `Latency-optimized: ${metrics.latencyMs}ms`;
          break;
        case 'cost':
          score = metrics.costPer1kTokens * 1000 + metrics.errorRate * 5000;
          reason = `Cost-optimized: $${metrics.costPer1kTokens}/1k tokens`;
          break;
        case 'balanced':
        default:
          const normalizedLatency = metrics.latencyMs / 1000;
          const normalizedCost = metrics.costPer1kTokens * 100;
          const errorPenalty = metrics.errorRate * 50;
          score = normalizedLatency * 0.5 + normalizedCost * 0.5 + errorPenalty;
          reason = `Balanced: latency=${metrics.latencyMs}ms, cost=$${metrics.costPer1kTokens}/1k`;
          break;
      }

      scores.push({ provider, score, reason });
    });

    return scores.sort((a, b) => a.score - b.score);
  }

  /**
   * Record a request result to update metrics
   */
  recordRequest(provider: ProviderType, duration: number, success: boolean): void {
    this.requestHistory.push({ provider, duration, success });

    const metrics = this.providers.get(provider);
    if (metrics) {
      metrics.requestCount++;
      if (!success) {
        metrics.errorRate = Math.min(metrics.errorRate + 0.1, 1);
      } else {
        metrics.errorRate = Math.max(metrics.errorRate - 0.02, 0);
        metrics.avgLatityMs = (metrics.avgLatityMs * (metrics.requestCount - 1) + duration) / metrics.requestCount;
      }
    }
  }

  /**
   * Get provider health status
   */
  getHealthStatus(): Record<ProviderType, { healthy: boolean; errorRate: number; avgLatency: number }> {
    const status: Record<string, any> = {};
    this.providers.forEach((metrics, provider) => {
      status[provider] = {
        healthy: metrics.isHealthy,
        errorRate: metrics.errorRate,
        avgLatency: metrics.avgLatityMs,
      };
    });
    return status;
  }
}

export const globalProviderRouter = new AIProviderRouter();
