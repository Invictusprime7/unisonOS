/**
 * AI Service Diagnostics Component
 * ==================================
 * 
 * Developer tool for diagnosing AI service configuration issues.
 * Shows the status of API keys, functions, and provides testing capabilities.
 * 
 * Usage: Add <AIServiceDiagnostics /> to your component tree temporarily
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { validateAIService, type AIServiceStatus } from '@/utils/aiServiceValidator';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, AlertCircle, Loader2, Terminal } from 'lucide-react';

export function AIServiceDiagnostics() {
  const [status, setStatus] = useState<AIServiceStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    checkService();
  }, []);

  const checkService = async () => {
    setIsChecking(true);
    const result = await validateAIService();
    setStatus(result);
    setIsChecking(false);
  };

  const testGeneration = async () => {
    setIsChecking(true);
    setTestResult('Testing...');
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-code-assistant', {
        body: {
          messages: [
            { role: 'user', content: 'Generate a simple HTML button with the text "Hello World"' }
          ],
          mode: 'code',
          editMode: false,
        }
      });

      if (error) {
        setTestResult(`❌ Error: ${error.message}`);
      } else if (data?.html || data?.content || data?.code) {
        const html = data.html || data.content || data.code;
        setTestResult(`✅ Success! Generated ${html.length} characters of HTML`);
      } else {
        setTestResult(`⚠️ Response received but no HTML content found. Response: ${JSON.stringify(data).substring(0, 200)}`);
      }
    } catch (error) {
      setTestResult(`❌ Exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsChecking(false);
    }
  };

  if (!status && !isChecking) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 shadow-2xl border-2 z-50 bg-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            AI Service Diagnostics
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={checkService}>
            Refresh
          </Button>
        </div>
        <CardDescription className="text-xs">
          Status check for template generation
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-3 text-sm">
        {isChecking ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Checking service...</span>
          </div>
        ) : status ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Function Available</span>
                {status.functionAvailable ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Available
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="w-3 h-3" />
                    Not Found
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">API Key Configured</span>
                {status.hasAPIKey ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="w-3 h-3" />
                    Missing
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Overall Status</span>
                {status.isConfigured ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Ready
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="w-3 h-3" />
                    Not Ready
                  </Badge>
                )}
              </div>
            </div>

            {status.error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-destructive leading-relaxed">{status.error}</p>
                </div>
              </div>
            )}

            <div className="pt-2 border-t space-y-2">
              <Button 
                onClick={testGeneration} 
                disabled={isChecking || !status.isConfigured}
                size="sm"
                className="w-full"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Generation'
                )}
              </Button>

              {testResult && (
                <div className="p-2 rounded bg-muted text-xs font-mono whitespace-pre-wrap">
                  {testResult}
                </div>
              )}
            </div>

            {!status.isConfigured && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  To fix this, set your API key in Supabase:
                </p>
                <code className="text-xs block mt-2 p-2 bg-muted rounded">
                  supabase secrets set GEMINI_API_KEY=your_key
                </code>
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
