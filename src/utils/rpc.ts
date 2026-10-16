/**
 * Typed RPC messaging layer for iframe communication
 */

type RPCMethod = 'fs.writeFile' | 'fs.readFile' | 'fs.deleteFile' | 
                 'runtime.reload' | 'runtime.applyCSS' | 'runtime.evalModule' |
                 'events.subscribe';

interface RPCRequest {
  id: string;
  method: RPCMethod;
  params: any[];
}

interface RPCResponse {
  id: string;
  result?: any;
  error?: string;
}

type RPCHandler = (...args: any[]) => Promise<any> | any;

export class RPCHost {
  private handlers = new Map<RPCMethod, RPCHandler>();
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: any) => void }>();
  private targetWindow: Window | null = null;
  private targetOrigin = '*';

  constructor() {
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  setTarget(window: Window, origin = '*') {
    this.targetWindow = window;
    this.targetOrigin = origin;
  }

  register(method: RPCMethod, handler: RPCHandler) {
    this.handlers.set(method, handler);
  }

  async call(method: RPCMethod, ...params: any[]): Promise<any> {
    if (!this.targetWindow) {
      throw new Error('No target window set');
    }

    const id = Math.random().toString(36).substring(7);
    const request: RPCRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.targetWindow!.postMessage(request, this.targetOrigin);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('RPC timeout'));
        }
      }, 10000);
    });
  }

  private async handleMessage(event: MessageEvent) {
    // Only the window this host was paired with may call it or answer it.
    if (!this.targetWindow || event.source !== this.targetWindow) return;
    if (this.targetOrigin !== '*' && event.origin !== this.targetOrigin) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    // Handle response
    if (data.id && this.pendingRequests.has(data.id)) {
      const { resolve, reject } = this.pendingRequests.get(data.id)!;
      this.pendingRequests.delete(data.id);
      
      if (data.error) {
        reject(new Error(data.error));
      } else {
        resolve(data.result);
      }
      return;
    }

    // Handle request
    if (data.method && this.handlers.has(data.method)) {
      const handler = this.handlers.get(data.method)!;
      const response: RPCResponse = { id: data.id };

      try {
        response.result = await handler(...(data.params || []));
      } catch (error) {
        response.error = error instanceof Error ? error.message : 'Unknown error';
      }

      event.source?.postMessage(response, { targetOrigin: event.origin } as any);
    }
  }

  destroy() {
    window.removeEventListener('message', this.handleMessage.bind(this));
    this.pendingRequests.clear();
    this.handlers.clear();
  }
}

export class RPCClient {
  private handlers = new Map<RPCMethod, RPCHandler>();
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: any) => void }>();

  constructor() {
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  register(method: RPCMethod, handler: RPCHandler) {
    this.handlers.set(method, handler);
  }

  async call(method: RPCMethod, ...params: any[]): Promise<any> {
    const id = Math.random().toString(36).substring(7);
    const request: RPCRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      window.parent.postMessage(request, '*');
      
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('RPC timeout'));
        }
      }, 10000);
    });
  }

  private async handleMessage(event: MessageEvent) {
    const data = event.data;

    if (data.id && this.pendingRequests.has(data.id)) {
      const { resolve, reject } = this.pendingRequests.get(data.id)!;
      this.pendingRequests.delete(data.id);
      
      if (data.error) {
        reject(new Error(data.error));
      } else {
        resolve(data.result);
      }
      return;
    }

    if (data.method && this.handlers.has(data.method)) {
      const handler = this.handlers.get(data.method)!;
      const response: RPCResponse = { id: data.id };

      try {
        response.result = await handler(...(data.params || []));
      } catch (error) {
        response.error = error instanceof Error ? error.message : 'Unknown error';
      }

      window.parent.postMessage(response, '*');
    }
  }

  destroy() {
    window.removeEventListener('message', this.handleMessage.bind(this));
    this.pendingRequests.clear();
    this.handlers.clear();
  }
}
