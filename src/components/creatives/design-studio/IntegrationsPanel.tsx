import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Zap, Code, Send, FileDown, Globe, Palette, Type as TypeIcon,
  Mail, MessageSquare, Database, Link2, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

interface IntegrationsPanelProps {
  onExport?: (format: string) => void;
  onIntegrationConnect?: (integration: string, config: any) => void;
}

export const IntegrationsPanel = ({ onExport, onIntegrationConnect }: IntegrationsPanelProps) => {
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [zapierWebhook, setZapierWebhook] = useState('');
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  const handleExport = (format: 'html' | 'react' | 'json') => {
    onExport?.(format);
    toast.success(`Exporting as ${format.toUpperCase()}...`);
  };

  const handleZapierConnect = () => {
    if (!zapierWebhook) {
      toast.error('Please enter a Zapier webhook URL');
      return;
    }
    onIntegrationConnect?.('zapier', { webhookUrl: zapierWebhook });
    toast.success('Zapier integration connected!');
  };

  const integrations = [
    {
      id: 'email',
      name: 'Email Notifications',
      description: 'Send form submissions via email',
      icon: Mail,
      color: 'text-blue-600',
      enabled: emailEnabled,
      onToggle: setEmailEnabled,
    },
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Connect to 5000+ apps',
      icon: Zap,
      color: 'text-amber-600',
      enabled: false,
      onToggle: () => {},
    },
    {
      id: 'analytics',
      name: 'Analytics',
      description: 'Track visitor behavior',
      icon: Database,
      color: 'text-green-600',
      enabled: analyticsEnabled,
      onToggle: setAnalyticsEnabled,
    },
    {
      id: 'ai',
      name: 'Affinity',
      description: 'Natural language editing',
      icon: Sparkles,
      color: 'text-purple-600',
      enabled: true,
      onToggle: () => {},
    },
  ];

  return (
    <div className="h-full overflow-auto bg-white">
      <div className="p-4 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Integrations & Export</h2>
          <p className="text-sm text-gray-500">Connect tools and export your design</p>
        </div>

        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileDown className="w-4 h-4" />
                  Export Your Design
                </CardTitle>
                <CardDescription className="text-xs">
                  Download your design in various formats
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={() => handleExport('html')}
                >
                  <div className="flex items-start gap-3 text-left">
                    <Globe className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">HTML + CSS</div>
                      <div className="text-xs text-gray-500">
                        Standalone website files
                      </div>
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={() => handleExport('react')}
                >
                  <div className="flex items-start gap-3 text-left">
                    <Code className="w-5 h-5 text-cyan-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">React Components</div>
                      <div className="text-xs text-gray-500">
                        JSX code for React apps
                      </div>
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3"
                  onClick={() => handleExport('json')}
                >
                  <div className="flex items-start gap-3 text-left">
                    <Database className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">JSON Data</div>
                      <div className="text-xs text-gray-500">
                        Design structure and data
                      </div>
                    </div>
                  </div>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">SEO & Meta Tags</CardTitle>
                <CardDescription className="text-xs">
                  Optimize for search engines
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="page-title" className="text-xs">Page Title</Label>
                  <Input
                    id="page-title"
                    placeholder="My Awesome Website"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta-desc" className="text-xs">Meta Description</Label>
                  <Input
                    id="meta-desc"
                    placeholder="A brief description..."
                    className="h-9 text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4 mt-4">
            <div className="space-y-3">
              {integrations.map((integration) => {
                const Icon = integration.icon;
                return (
                  <Card key={integration.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`${integration.color} mt-1`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-sm font-medium text-gray-900">
                              {integration.name}
                            </h3>
                            <Switch
                              checked={integration.enabled}
                              onCheckedChange={integration.onToggle}
                            />
                          </div>
                          <p className="text-xs text-gray-500">
                            {integration.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-600" />
                  Zapier Integration
                </CardTitle>
                <CardDescription className="text-xs">
                  Connect forms to 5000+ apps
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="zapier-webhook" className="text-xs">
                    Webhook URL
                  </Label>
                  <Input
                    id="zapier-webhook"
                    type="url"
                    placeholder="https://hooks.zapier.com/..."
                    value={zapierWebhook}
                    onChange={(e) => setZapierWebhook(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleZapierConnect}
                  className="w-full"
                >
                  Connect Zapier
                </Button>
                <p className="text-xs text-gray-500">
                  <Link2 className="w-3 h-3 inline mr-1" />
                  <a
                    href="https://zapier.com/apps/webhook/integrations"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Get webhook URL from Zapier
                  </a>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  AI Features
                </CardTitle>
                <CardDescription className="text-xs">
                  Powered by your configured AI provider
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  Natural language editing
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  Content generation
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  Image generation
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  Layout suggestions
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};