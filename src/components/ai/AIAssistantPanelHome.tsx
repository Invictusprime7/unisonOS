/**
 * AIAssistantPanel - Homepage inline panel version of the AI assistant
 * 
 * This is an embedded panel version designed for the homepage,
 * showing the AI assistant as part of the SystemsAI section.
 * 
 * Uses AIAssistantCore for shared functionality.
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AIAssistantCore, QuickAction } from "./AIAssistantCore";
import { 
  Bot, 
  Sparkles, 
  Code2, 
  Palette, 
  Zap, 
  FileCode,
  Wand2,
  LayoutTemplate
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AIAssistantPanelHomeProps {
  /** Class name for the outer container */
  className?: string;
  /** System type context */
  systemType?: string;
  /** Business name for context */
  businessName?: string;
  /** Current template/code context */
  contextCode?: string;
  /** Callback when code is generated */
  onCodeGenerated?: (code: string) => void;
  /** Callback to navigate to web builder with generated code */
  onOpenBuilder?: (code: string) => void;
}

// Default quick actions for the homepage panel
const defaultQuickActions: QuickAction[] = [
  {
    id: "landing-page",
    label: "Landing Page",
    prompt: "Create a professional landing page with a hero section, features, testimonials, and call-to-action",
    icon: <LayoutTemplate className="w-3 h-3" />,
  },
  {
    id: "booking-site",
    label: "Booking Site",
    prompt: "Create a service booking website with online scheduling, service menu, and contact form",
    icon: <Zap className="w-3 h-3" />,
  },
  {
    id: "portfolio",
    label: "Portfolio",
    prompt: "Create a portfolio website to showcase my work with project gallery and about section",
    icon: <Palette className="w-3 h-3" />,
  },
  {
    id: "business-site",
    label: "Business Site",
    prompt: "Create a professional business website with services, team, and contact information",
    icon: <FileCode className="w-3 h-3" />,
  },
];

export const AIAssistantPanelHome: React.FC<AIAssistantPanelHomeProps> = ({
  className,
  systemType,
  businessName,
  contextCode,
  onCodeGenerated,
  onOpenBuilder,
}) => {
  const handleCodeGenerated = (code: string) => {
    onCodeGenerated?.(code);
    
    // Store for potential navigation to builder
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("ai_panel_generated_code", code);
    }
  };

  return (
    <Card className={cn("border-2 shadow-lg overflow-hidden", className)}>
      <CardHeader className="pb-2 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              AI Code Assistant
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                Powered by AI
              </Badge>
            </CardTitle>
            <CardDescription>
              Describe what you want to build and I'll generate the code
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <AIAssistantCore
          className="border-0 rounded-none h-[450px]"
          placeholder="Describe the website or component you want to create..."
          quickActions={defaultQuickActions}
          onCodeGenerated={handleCodeGenerated}
          contextCode={contextCode}
          systemType={systemType}
          businessName={businessName}
          showFileUpload={true}
          allowClearHistory={true}
          hideHeader={true}
        />
      </CardContent>
    </Card>
  );
};

export default AIAssistantPanelHome;
