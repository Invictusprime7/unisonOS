import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileCode, Copy, Check, Package, Code2, FileJson, Globe, Smartphone, FolderArchive } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import JSZip from "jszip";
import { exportSourceProject, downloadBlob } from "@/services/export/exportSourceProject";
import type { RuntimeManifest } from "@/types/runtimeManifest";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  html: string;
  css: string;
  js?: string;
  projectName?: string;
  /** Full canonical VFS — enables "Vite Source Project" (Mode B) export. */
  vfsFiles?: Record<string, string>;
  /** Runtime manifest used to synthesize package.json + env requirements. */
  runtimeManifest?: RuntimeManifest;
}

export const ExportDialog = ({
  open,
  onOpenChange,
  html,
  css,
  js = "",
  projectName = "my-project",
  vfsFiles,
  runtimeManifest,
}: ExportDialogProps) => {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [sourceExportWarnings, setSourceExportWarnings] = useState<string[] | null>(null);
  const hasCanonicalVfs = Boolean(vfsFiles && Object.keys(vfsFiles).length > 0);

  // Extract JavaScript from HTML if not provided separately
  const extractedJS = useMemo(() => {
    if (js) return js;
    const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    if (scriptMatch) {
      return scriptMatch
        .map(s => s.replace(/<script[^>]*>|<\/script>/gi, ''))
        .join('\n\n');
    }
    return '';
  }, [html, js]);

  // Generate clean HTML without inline scripts
  const cleanHTML = useMemo(() => {
    let cleaned = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    // Add external script reference if JS exists
    if (extractedJS) {
      cleaned = cleaned.replace('</body>', '  <script src="script.js"></script>\n</body>');
    }
    return cleaned;
  }, [html, extractedJS]);

  // Generate full standalone HTML
  const fullHTML = useMemo(() => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Generated with AI Web Builder">
  <title>${projectName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
${css}
  </style>
</head>
<body>
${html.includes('<body>') ? html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html : html}
${extractedJS ? `  <script>\n${extractedJS}\n  </script>` : ''}
</body>
</html>`;
  }, [html, css, extractedJS, projectName]);

  // Generate React component
  const reactComponent = useMemo(() => {
    const componentName = projectName
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join('');

    // Convert HTML to JSX-compatible format
    const jsxContent = html
      .replace(/class=/g, 'className=')
      .replace(/for=/g, 'htmlFor=')
      .replace(/onclick=/gi, 'onClick=')
      .replace(/onchange=/gi, 'onChange=')
      .replace(/onsubmit=/gi, 'onSubmit=')
      .replace(/tabindex=/gi, 'tabIndex=')
      .replace(/readonly/gi, 'readOnly')
      .replace(/autocomplete=/gi, 'autoComplete=')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<br>/g, '<br />')
      .replace(/<hr>/g, '<hr />')
      .replace(/<img([^>]*)>/g, '<img$1 />')
      .replace(/<input([^>]*)>/g, '<input$1 />');

    return `import React from 'react';
import './styles.css';

interface ${componentName}Props {
  className?: string;
}

const ${componentName}: React.FC<${componentName}Props> = ({ className }) => {
  return (
    <div className={\`${componentName.toLowerCase()}-container \${className || ''}\`}>
      ${jsxContent}
    </div>
  );
};

export default ${componentName};

// styles.css content:
/*
${css}
*/
`;
  }, [html, css, projectName]);

  // Generate Vue component
  const vueComponent = useMemo(() => {
    const componentName = projectName
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join('');

    return `<template>
  <div class="${componentName.toLowerCase()}-container">
    ${html}
  </div>
</template>

<script setup lang="ts">
defineProps<{
  className?: string;
}>();
${extractedJS ? `\n// Component logic\n${extractedJS}` : ''}
</script>

<style scoped>
${css}
</style>
`;
  }, [html, css, extractedJS, projectName]);

  // Generate Next.js page component
  const nextjsComponent = useMemo(() => {
    const componentName = projectName
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join('');

    const jsxContent = html
      .replace(/class=/g, 'className=')
      .replace(/for=/g, 'htmlFor=')
      .replace(/onclick=/gi, 'onClick=')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<br>/g, '<br />')
      .replace(/<hr>/g, '<hr />')
      .replace(/<img([^>]*)>/g, '<img$1 />')
      .replace(/<input([^>]*)>/g, '<input$1 />');

    return `import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: '${projectName}',
  description: 'Generated with AI Web Builder',
};

export default function ${componentName}Page() {
  return (
    <main className="${componentName.toLowerCase()}-container">
      ${jsxContent}
    </main>
  );
}
`;
  }, [html, projectName]);

  // Generate JSON export
  const jsonExport = useMemo(() => {
    return JSON.stringify({
      name: projectName,
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      files: {
        "index.html": fullHTML,
        "styles.css": css,
        ...(extractedJS && { "script.js": extractedJS }),
      },
      metadata: {
        generator: "AI Web Builder",
        htmlLength: html.length,
        cssLength: css.length,
        jsLength: extractedJS.length,
      }
    }, null, 2);
  }, [fullHTML, css, extractedJS, projectName, html]);

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  const downloadZip = async (format: 'html' | 'react' | 'vue' | 'nextjs') => {
    setIsExporting(true);
    try {
      const zip = new JSZip();
      const folderName = `${projectName}-${format}`;
      const folder = zip.folder(folderName);
      
      if (!folder) throw new Error('Failed to create folder');

      switch (format) {
        case 'html':
          folder.file('index.html', fullHTML);
          folder.file('styles.css', css);
          if (extractedJS) folder.file('script.js', extractedJS);
          folder.file('README.md', `# ${projectName}\n\nGenerated with AI Web Builder.\n\n## Files\n- index.html - Main HTML file\n- styles.css - Stylesheet\n${extractedJS ? '- script.js - JavaScript functionality\n' : ''}\n## Usage\nOpen index.html in your browser.`);
          break;
          
        case 'react':
          const srcFolder = folder.folder('src');
          srcFolder?.file(`${projectName}.tsx`, reactComponent);
          srcFolder?.file('styles.css', css);
          folder.file('package.json', JSON.stringify({
            name: projectName.toLowerCase().replace(/\s+/g, '-'),
            version: '1.0.0',
            private: true,
            dependencies: {
              react: '^18.2.0',
              'react-dom': '^18.2.0',
            },
            devDependencies: {
              '@types/react': '^18.2.0',
              '@types/react-dom': '^18.2.0',
              typescript: '^5.0.0',
              vite: '^5.0.0',
              '@vitejs/plugin-react': '^4.0.0',
            },
            scripts: {
              dev: 'vite',
              build: 'vite build',
              preview: 'vite preview',
            },
          }, null, 2));
          folder.file('README.md', `# ${projectName}\n\nReact component generated with AI Web Builder.\n\n## Setup\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\``);
          break;
          
        case 'vue':
          const vueSrc = folder.folder('src');
          vueSrc?.file(`${projectName}.vue`, vueComponent);
          folder.file('package.json', JSON.stringify({
            name: projectName.toLowerCase().replace(/\s+/g, '-'),
            version: '1.0.0',
            private: true,
            dependencies: {
              vue: '^3.4.0',
            },
            devDependencies: {
              '@vitejs/plugin-vue': '^5.0.0',
              typescript: '^5.0.0',
              vite: '^5.0.0',
              'vue-tsc': '^2.0.0',
            },
            scripts: {
              dev: 'vite',
              build: 'vue-tsc && vite build',
              preview: 'vite preview',
            },
          }, null, 2));
          folder.file('README.md', `# ${projectName}\n\nVue component generated with AI Web Builder.\n\n## Setup\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\``);
          break;
          
        case 'nextjs':
          const appFolder = folder.folder('app');
          appFolder?.file('page.tsx', nextjsComponent);
          appFolder?.file('styles.css', css);
          appFolder?.file('layout.tsx', `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '${projectName}',
  description: 'Generated with AI Web Builder',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`);
          appFolder?.file('globals.css', `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n${css}`);
          folder.file('package.json', JSON.stringify({
            name: projectName.toLowerCase().replace(/\s+/g, '-'),
            version: '1.0.0',
            private: true,
            scripts: {
              dev: 'next dev',
              build: 'next build',
              start: 'next start',
            },
            dependencies: {
              next: '^14.0.0',
              react: '^18.2.0',
              'react-dom': '^18.2.0',
            },
            devDependencies: {
              '@types/node': '^20.0.0',
              '@types/react': '^18.2.0',
              typescript: '^5.0.0',
              tailwindcss: '^3.4.0',
              autoprefixer: '^10.0.0',
              postcss: '^8.0.0',
            },
          }, null, 2));
          folder.file('README.md', `# ${projectName}\n\nNext.js page generated with AI Web Builder.\n\n## Setup\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\``);
          break;
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${folderName}.zip`);
    } catch (error) {
      toast.error('Failed to create ZIP file');
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = async (text: string, tabName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTab(tabName);
      setTimeout(() => setCopiedTab(null), 2000);
      toast.success(`${tabName} copied to clipboard`);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Export Project
          </DialogTitle>
          <DialogDescription>
            {hasCanonicalVfs
              ? 'Download the canonical source archive with Unison metadata and export checks.'
              : 'Export the current standalone code snippets.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Portable Vite source project (Mode B) — top priority when VFS available */}
          {hasCanonicalVfs && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium flex items-center gap-2">
                  <FolderArchive className="h-4 w-4 text-primary" />
                  Vite + React source archive
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Canonical source with design context, runtime/backend metadata, assets, and round-trip Unison files.
                </p>
              </div>
              <Button
                onClick={async () => {
                  setIsExporting(true);
                  try {
                    const result = await exportSourceProject(vfsFiles!, {
                      projectName,
                      manifest: runtimeManifest,
                      entryPoint: runtimeManifest?.entryPoint,
                    });
                    downloadBlob(result.blob, result.fileName);
                    setSourceExportWarnings(result.preflight.warnings.map((warning) => (
                      warning.code === 'lockfile-missing'
                        ? 'No project-specific lockfile is included.'
                        : `Dependency version needs pinning: ${warning.packageName ?? 'unknown package'}.`
                    )));
                    toast.success(`Exported ${result.fileCount} files → ${result.fileName}`);
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    toast.error(`Source export failed: ${msg}`);
                  } finally {
                    setIsExporting(false);
                  }
                }}
                disabled={isExporting}
                className="shrink-0"
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? 'Preparing…' : 'Download .zip'}
              </Button>
            </div>
          )}

          {hasCanonicalVfs && (
            <>
              <ul className="grid gap-x-6 gap-y-2 border-b border-border pb-4 text-xs text-muted-foreground sm:grid-cols-2">
                <li><FileJson className="mr-2 inline h-3.5 w-3.5" />project-manifest.json</li>
                <li><FileCode className="mr-2 inline h-3.5 w-3.5" />design-context.json</li>
                <li><FileCode className="mr-2 inline h-3.5 w-3.5" />unison.runtime.json</li>
                <li><FileCode className="mr-2 inline h-3.5 w-3.5" />backend-capabilities.json</li>
                <li><FileJson className="mr-2 inline h-3.5 w-3.5" />asset-manifest.json</li>
                <li><FolderArchive className="mr-2 inline h-3.5 w-3.5" />.unison/ round-trip metadata</li>
              </ul>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Base toolchain versions are pinned. No project-specific lockfile is generated; see export-preflight.json for dependency warnings.
              </p>
              {sourceExportWarnings && (
                <div role="status" className="border-t border-border pt-3 text-xs text-muted-foreground">
                  Archive prepared and downloaded.
                  {sourceExportWarnings.length === 0
                    ? <p className="mt-1">No dependency-closure warnings.</p>
                    : sourceExportWarnings.map((warning) => <p key={warning} className="mt-1">{warning}</p>)}
                </div>
              )}
            </>
          )}

          {!hasCanonicalVfs && (
            <>
          {/* Quick Export Buttons (legacy snippet-only mode) */}
          <div className="flex flex-wrap gap-2">

            <Button onClick={() => downloadZip('html')} variant="default" disabled={isExporting}>
              <Globe className="mr-2 h-4 w-4" />
              HTML/CSS/JS
            </Button>
            <Button onClick={() => downloadZip('react')} variant="outline" disabled={isExporting}>
              <Code2 className="mr-2 h-4 w-4" />
              React
            </Button>
            <Button onClick={() => downloadZip('vue')} variant="outline" disabled={isExporting}>
              <Code2 className="mr-2 h-4 w-4" />
              Vue
            </Button>
            <Button onClick={() => downloadZip('nextjs')} variant="outline" disabled={isExporting}>
              <Smartphone className="mr-2 h-4 w-4" />
              Next.js
            </Button>
            <Button 
              onClick={() => downloadFile(jsonExport, `${projectName}.json`, 'application/json')} 
              variant="ghost"
              disabled={isExporting}
            >
              <FileJson className="mr-2 h-4 w-4" />
              JSON
            </Button>
          </div>

          <Separator />

          {/* Code Preview Tabs */}
          <Tabs defaultValue="html" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="html" className="text-xs">HTML</TabsTrigger>
              <TabsTrigger value="css" className="text-xs">CSS</TabsTrigger>
              <TabsTrigger value="js" className="text-xs">JS</TabsTrigger>
              <TabsTrigger value="react" className="text-xs">React</TabsTrigger>
              <TabsTrigger value="vue" className="text-xs">Vue</TabsTrigger>
              <TabsTrigger value="nextjs" className="text-xs">Next.js</TabsTrigger>
            </TabsList>

            <TabsContent value="html" className="mt-4">
              <CodePreview 
                code={fullHTML} 
                language="html"
                onCopy={() => copyToClipboard(fullHTML, 'HTML')}
                copied={copiedTab === 'HTML'}
                badge="Standalone HTML"
              />
            </TabsContent>

            <TabsContent value="css" className="mt-4">
              <CodePreview 
                code={css} 
                language="css"
                onCopy={() => copyToClipboard(css, 'CSS')}
                copied={copiedTab === 'CSS'}
                badge="Stylesheet"
              />
            </TabsContent>

            <TabsContent value="js" className="mt-4">
              <CodePreview 
                code={extractedJS || '// No JavaScript in this template'} 
                language="javascript"
                onCopy={() => copyToClipboard(extractedJS, 'JavaScript')}
                copied={copiedTab === 'JavaScript'}
                badge="Script"
                disabled={!extractedJS}
              />
            </TabsContent>

            <TabsContent value="react" className="mt-4">
              <CodePreview 
                code={reactComponent} 
                language="typescript"
                onCopy={() => copyToClipboard(reactComponent, 'React')}
                copied={copiedTab === 'React'}
                badge="React + TypeScript"
              />
            </TabsContent>

            <TabsContent value="vue" className="mt-4">
              <CodePreview 
                code={vueComponent} 
                language="vue"
                onCopy={() => copyToClipboard(vueComponent, 'Vue')}
                copied={copiedTab === 'Vue'}
                badge="Vue 3 SFC"
              />
            </TabsContent>

            <TabsContent value="nextjs" className="mt-4">
              <CodePreview 
                code={nextjsComponent} 
                language="typescript"
                onCopy={() => copyToClipboard(nextjsComponent, 'Next.js')}
                copied={copiedTab === 'Next.js'}
                badge="Next.js 14 App Router"
              />
            </TabsContent>
          </Tabs>

          {/* Stats Footer */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
            <span>HTML: {html.length.toLocaleString()} chars</span>
            <span>CSS: {css.length.toLocaleString()} chars</span>
            {extractedJS && <span>JS: {extractedJS.length.toLocaleString()} chars</span>}
          </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Code Preview Component
interface CodePreviewProps {
  code: string;
  language: string;
  onCopy: () => void;
  copied: boolean;
  badge?: string;
  disabled?: boolean;
}

const CodePreview = ({ code, language, onCopy, copied, badge, disabled }: CodePreviewProps) => (
  <div className="relative">
    <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
      {badge && <Badge variant="secondary" className="text-xs">{badge}</Badge>}
      <Button
        size="sm"
        variant="outline"
        onClick={onCopy}
        disabled={disabled}
        className="h-8"
      >
        {copied ? (
          <Check className="h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
    <ScrollArea className="h-[280px] w-full rounded-md border bg-muted/50 p-4">
      <pre className="text-sm font-mono">
        <code className={disabled ? 'text-muted-foreground' : ''}>{code}</code>
      </pre>
    </ScrollArea>
  </div>
);
