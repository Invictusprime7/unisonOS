/**
 * AI Execution Bridge - Remote Execution & Provider Abstraction
 * 
 * Similar to OpenClaude's bridge architecture, provides:
 * - Abstraction over supported AI providers
 * - Structured messaging and session tracking
 * - Cost monitoring per request
 * - Health status and fallback handling
 * - Streaming response support
 */

import { globalProviderRouter } from '@/services/aiProviderRouter';
import { globalSkillRegistry } from '@/services/aiSkillRegistry';
import { supabase } from '@/integrations/supabase/client';
import type { ProviderType } from '@/services/aiProviderRouter';

/**
 * A message in an AI conversation
 */
export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Request to the AI bridge
 */
export interface AIBridgeRequest {
  messages: AIMessage[];
  mode?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
  tools?: unknown[];
}

interface AssistantInvokeResponse {
  content?: string;
  code?: string;
  reasoning?: string;
  modelUsed?: string;
  error?: string;
}

/**
 * Response from the AI bridge
 */
export interface AIBridgeResponse {
  content: string;
  provider: ProviderType;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
  latency: number;
  toolCalls?: Array<{ name: string; input: Record<string, unknown> }>;
}

/**
 * Session tracking for multi-turn conversations
 */
export interface AIBridgeSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  totalTokens: number;
  totalCost: number;
  provider: ProviderType;
  messages: AIMessage[];
}

/**
 * The main AI bridge for executing requests
 */
export class AIExecutionBridge {
  private sessions: Map<string, AIBridgeSession> = new Map();
  private sessionCounter = 0;

  /**
   * Create a new bridge session
   */
  createSession(): AIBridgeSession {
    const id = `session_${++this.sessionCounter}_${Date.now()}`;
    const session: AIBridgeSession = {
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      totalTokens: 0,
      totalCost: 0,
      provider: globalProviderRouter.selectProvider(),
      messages: [],
    };
    this.sessions.set(id, session);
    return session;
  }

  /**
   * Get or create a session
   */
  getSession(id: string): AIBridgeSession | null {
    return this.sessions.get(id) || null;
  }

  /**
   * End a session
   */
  closeSession(id: string): void {
    this.sessions.delete(id);
  }

  /**
   * Execute a request through the bridge
   */
  async executeRequest(
    sessionId: string,
    userMessage: string,
    options?: Partial<AIBridgeRequest>
  ): Promise<AIBridgeResponse> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const startTime = Date.now();

    // Build messages
    const systemMessage: AIMessage = {
      role: 'system',
      content: globalSkillRegistry.getSystemPrompt(),
    };

    const messages: AIMessage[] = [systemMessage, ...session.messages];
    messages.push({ role: 'user', content: userMessage });

    const req: AIBridgeRequest = {
      messages,
      mode: options?.mode,
      model: options?.model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      streaming: options?.streaming,
      tools: options?.tools,
    };

    const gatewayOptions = {
      selectedModelId: req.model,
      maxTokens: req.maxTokens,
      autoModelSelection: req.model ? false : true,
    };

    const hasGatewayOverrides = Boolean(gatewayOptions.selectedModelId || gatewayOptions.maxTokens);

    try {
      const { data, error } = await supabase.functions.invoke<AssistantInvokeResponse>('ai-code-assistant', {
        body: {
          messages: req.messages,
          mode: req.mode || 'code',
          ...(hasGatewayOverrides ? { gatewayOptions } : {}),
          debugMode: req.mode === 'debug',
          editMode: req.mode === 'edit',
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to invoke ai-code-assistant');
      }

      const responseText = data?.content || data?.code || data?.reasoning || '[No content returned]';
      const inputTokens = Math.ceil(messages.reduce((acc, msg) => acc + msg.content.length, 0) / 4);
      const outputTokens = Math.ceil(responseText.length / 4);
      const selectedProvider = this.resolveProviderFromModel(data?.modelUsed, session.provider);

      const response: AIBridgeResponse = {
        content: responseText,
        provider: selectedProvider,
        tokensUsed: {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens,
        },
        cost: this.estimateCost(selectedProvider, inputTokens, outputTokens),
        latency: Date.now() - startTime,
      };

      // Record metrics
      globalProviderRouter.recordRequest(selectedProvider, response.latency, true);

      // Update session
      session.provider = selectedProvider;
      session.messages.push({ role: 'user', content: userMessage });
      session.messages.push({ role: 'assistant', content: response.content });
      session.messageCount++;
      session.totalTokens += response.tokensUsed.total;
      session.totalCost += response.cost;
      session.updatedAt = Date.now();

      return response;
    } catch (error) {
      globalProviderRouter.recordRequest(session.provider, Date.now() - startTime, false);

      // Try to fallback to another provider
      const scores = globalProviderRouter.scoreAllProviders();
      for (const { provider } of scores) {
        if (provider === session.provider) continue;
        session.provider = provider;
        // Could retry here, but for now just fail
        break;
      }

      // Last-resort local fallback to avoid blank UX.
      return this.buildFallbackResponse(session, userMessage, startTime);
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string): { messages: number; tokens: number; cost: number } | null {
    const session = this.getSession(sessionId);
    if (!session) return null;
    return {
      messages: session.messageCount,
      tokens: session.totalTokens,
      cost: session.totalCost,
    };
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): AIBridgeSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get provider health via bridge
   */
  getProviderStatus(): Record<string, unknown> {
    return globalProviderRouter.getHealthStatus();
  }

  private resolveProviderFromModel(modelUsed: string | undefined, fallback: ProviderType): ProviderType {
    if (!modelUsed) return fallback;
    const normalized = modelUsed.toLowerCase();
    if (normalized.includes('gemini') || normalized.includes('google')) return 'gemini';
    if (normalized.includes('claude') || normalized.includes('anthropic')) return 'claude';
    if (normalized.includes('ollama')) return 'ollama';
    return fallback;
  }

  private estimateCost(provider: ProviderType, inputTokens: number, outputTokens: number): number {
    const estimated1kCost: Record<ProviderType, number> = {
      claude: 0.003,
      gemini: 0.0005,
      local: 0,
      ollama: 0,
    };
    const totalTokens = inputTokens + outputTokens;
    return Number(((totalTokens / 1000) * estimated1kCost[provider]).toFixed(6));
  }

  private buildFallbackResponse(session: AIBridgeSession, userMessage: string, startTime: number): AIBridgeResponse {
    const content = `I could not reach the remote AI provider, but I can still help. Start with this command sequence:\n1) diagnose\n2) tree\n3) cat /src/App.tsx\n\nOriginal request: ${userMessage}`;
    const inputTokens = Math.ceil(userMessage.length / 4);
    const outputTokens = Math.ceil(content.length / 4);

    const response: AIBridgeResponse = {
      content,
      provider: 'local',
      tokensUsed: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      },
      cost: 0,
      latency: Date.now() - startTime,
    };

    session.provider = 'local';
    session.messages.push({ role: 'user', content: userMessage });
    session.messages.push({ role: 'assistant', content: response.content });
    session.messageCount++;
    session.totalTokens += response.tokensUsed.total;
    session.updatedAt = Date.now();

    return response;
  }
}

/**
 * Global singleton bridge instance
 */
export const globalAIBridge = new AIExecutionBridge();
