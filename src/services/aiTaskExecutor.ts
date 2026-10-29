/**
 * AI Task Executor for Claude Integration
 * 
 * Provides structured task execution for AI models, enabling:
 * - Multi-step troubleshooting workflows
 * - Real-time VFS state queries
 * - Runtime execution and error recovery
 * - Conversation context management
 * 
 * Implements Claude-compatible patterns for:
 * - Tool/function calling
 * - Streaming responses
 * - Error handling and retries
 * - Context window management
 */

import { getGlobalAITerminalBridge } from '@/services/aiTerminalBridge';
import type {
  TerminalAIHelpRequest,
} from '@/types/aiTerminalIntegration';

/**
 * Represents a task that Claude can execute through the terminal
 */
export interface AITask {
  id: string;
  name: string;
  description: string;
  steps: TaskStep[];
  createdAt: number;
  completedAt?: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  result?: TaskResult;
}

/**
 * A single step in an AI task
 */
export interface TaskStep {
  id: string;
  name: string;
  type: 'command' | 'runtime' | 'analyze' | 'help-request' | 'conditional';
  input: string;
  output?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  error?: string;
  retries?: number;
}

/**
 * Result of executing an AI task
 */
export interface TaskResult {
  success: boolean;
  summary: string;
  resolvedIssues: string[];
  appliedFixes: { filePath: string; change: string }[];
  errors: string[];
  duration: number;
}

/**
 * Claude tool function definition for function calling
 */
export interface ClaudeToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * Executor for AI tasks with Claude integration
 */
export class AITaskExecutor {
  private tasks: Map<string, AITask> = new Map();
  private toolDefinitions: Map<string, ClaudeToolDefinition> = new Map();
  private tools: Map<string, (input: Record<string, unknown>) => Promise<unknown>> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  /**
   * Register default tools available to Claude
   */
  private registerDefaultTools(): void {
    this.registerTool('vfs_diagnose', {
      name: 'vfs_diagnose',
      description: 'Get diagnostic information about the VFS state, dependencies, and issues',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
    }, async () => {
      const bridge = getGlobalAITerminalBridge();
      return {
        vfs: bridge.getVFSSnapshot(),
        dependencies: bridge.getCurrentDependencies(),
      };
    });

    this.registerTool('execute_command', {
      name: 'execute_command',
      description: 'Execute a terminal command on the VFS (install, ls, cat, diagnose, etc)',
      input_schema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The terminal command to execute' },
          reason: { type: 'string', description: 'Why this command is being executed' },
        },
        required: ['command'],
      },
    }, async (input) => {
      const bridge = getGlobalAITerminalBridge();
      const result = await bridge.executeCommand({
        id: `cmd_${Date.now()}`,
        command: String(input.command),
        reason: String(input.reason || ''),
        structured: true,
      });
      return result;
    });

    this.registerTool('execute_runtime', {
      name: 'execute_runtime',
      description: 'Execute a Node.js runtime command (npm install, tsc --noEmit, npm test)',
      input_schema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The Node.js command to execute' },
          timeout: { type: 'number', description: 'Timeout in milliseconds' },
        },
        required: ['command'],
      },
    }, async (input) => {
      const bridge = getGlobalAITerminalBridge();
      const result = await bridge.executeRuntime({
        id: `run_${Date.now()}`,
        command: String(input.command),
        timeout: typeof input.timeout === 'number' ? input.timeout : 30000,
      });
      return result;
    });

    this.registerTool('request_help', {
      name: 'request_help',
      description: 'Request help from the terminal AI for a specific issue or error',
      input_schema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['fix-error', 'explain-issue', 'suggest-command', 'analyze-imports', 'resolve-deps'],
          },
          problem: { type: 'string', description: 'Description of the problem' },
          filePath: { type: 'string', description: 'File path if relevant' },
          code: { type: 'string', description: 'Code snippet if relevant' },
        },
        required: ['type', 'problem'],
      },
    }, async (input) => {
      const bridge = getGlobalAITerminalBridge();
      const result = await bridge.requestHelp({
        type: input.type as TerminalAIHelpRequest['type'],
        problem: String(input.problem),
        filePath: input.filePath ? String(input.filePath) : undefined,
        code: input.code ? String(input.code) : undefined,
      });
      return result;
    });

    this.registerTool('get_context_summary', {
      name: 'get_context_summary',
      description: 'Get a summary of the conversation context and recently fixed issues',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
    }, async () => {
      const bridge = getGlobalAITerminalBridge();
      return {
        context: bridge.getContextSummary(),
        conversation: bridge.getConversation(),
        history: bridge.getHistory(10),
      };
    });

    this.registerTool('create_task', {
      name: 'create_task',
      description: 'Create a multi-step task for systematic problem solving',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Task name' },
          description: { type: 'string', description: 'Task description' },
          steps: {
            type: 'array',
            description: 'Array of task steps',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                input: { type: 'string' },
              },
            },
          },
        },
        required: ['name', 'steps'],
      },
    }, async (input) => {
      const taskId = `task_${Date.now()}`;
      const validStepTypes = ['command', 'runtime', 'help-request', 'analyze', 'conditional'];
      const task: AITask = {
        id: taskId,
        name: String(input.name),
        description: String(input.description || ''),
        steps: (Array.isArray(input.steps) ? input.steps : []).map((step: any, idx: number) => {
          const stepType = String(step.type);
          return {
            id: `step_${idx}`,
            name: String(step.name),
            type: (validStepTypes.includes(stepType) ? stepType : 'command') as TaskStep['type'],
            input: String(step.input),
            status: 'pending' as const,
          };
        }),
        createdAt: Date.now(),
        status: 'pending',
      };
      this.tasks.set(taskId, task);
      return { taskId, task };
    });

    this.registerTool('execute_task', {
      name: 'execute_task',
      description: 'Execute a multi-step task step-by-step',
      input_schema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'The task ID to execute' },
        },
        required: ['taskId'],
      },
    }, async (input) => {
      return this.executeTask(String(input.taskId));
    });
  }

  /**
   * Register a custom tool for Claude to use
   */
  registerTool(
    name: string,
    definition: ClaudeToolDefinition,
    handler: (input: Record<string, unknown>) => Promise<unknown>
  ): void {
    this.toolDefinitions.set(name, definition);
    this.tools.set(name, handler);
  }

  /**
   * Get all available tool definitions (for Claude function calling)
   */
  getAvailableTools(): ClaudeToolDefinition[] {
    return Array.from(this.toolDefinitions.values());
  }

  /**
   * Execute a tool by name
   */
  async executeToolCall(toolName: string, input: Record<string, unknown>): Promise<unknown> {
    const handler = this.tools.get(toolName);
    if (!handler) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    return handler(input);
  }

  /**
   * Execute a multi-step task
   */
  async executeTask(taskId: string): Promise<TaskResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const startTime = Date.now();
    task.status = 'in-progress';
    const resolvedIssues: string[] = [];
    const errors: string[] = [];

    try {
      for (const step of task.steps) {
        step.status = 'executing';

        try {
          let output: unknown;

          switch (step.type) {
            case 'command':
              output = await this.executeToolCall('execute_command', { command: step.input });
              break;
            case 'runtime':
              output = await this.executeToolCall('execute_runtime', { command: step.input });
              break;
            case 'analyze':
              output = await this.executeToolCall('vfs_diagnose', {});
              break;
            case 'help-request':
              output = await this.executeToolCall('request_help', { type: 'explain-issue', problem: step.input });
              break;
            default:
              throw new Error(`Unknown step type: ${step.type}`);
          }

          step.output = JSON.stringify(output);
          step.status = 'completed';
          resolvedIssues.push(step.name);
        } catch (error) {
          step.error = error instanceof Error ? error.message : String(error);
          step.status = 'failed';
          errors.push(`${step.name}: ${step.error}`);
        }
      }

      task.status = 'completed';
    } catch (error) {
      task.status = 'failed';
      errors.push(error instanceof Error ? error.message : String(error));
    }

    const result: TaskResult = {
      success: task.status === 'completed' && errors.length === 0,
      summary: `Task "${task.name}" ${task.status}`,
      resolvedIssues,
      appliedFixes: [],
      errors,
      duration: Date.now() - startTime,
    };

    task.result = result;
    task.completedAt = Date.now();

    return result;
  }

  /**
   * Get task status
   */
  getTask(taskId: string): AITask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): AITask[] {
    return Array.from(this.tasks.values());
  }
}

// ============================================================================
// Singleton instance for app-wide use
// ============================================================================

let globalExecutor: AITaskExecutor | null = null;

export function getGlobalAITaskExecutor(): AITaskExecutor {
  if (!globalExecutor) {
    globalExecutor = new AITaskExecutor();
  }
  return globalExecutor;
}

export function resetGlobalAITaskExecutor(): void {
  globalExecutor = null;
}
