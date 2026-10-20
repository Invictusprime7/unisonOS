/**
 * AIAssistantWidget - Floating widget version of the AI assistant for Web Builder
 * 
 * This is a floating/collapsible widget designed for the web builder,
 * providing quick AI assistance while editing.
 * 
 * Uses AIAssistantCore for shared functionality.
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { AIAssistantCore, QuickAction } from "./AIAssistantCore";
import { 
  Bot, 
  Sparkles, 
  X, 
  Minimize2,
  Maximize2,
  Code2,
  Wand2,
  Palette,
  Zap,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BusinessSystemType } from "@/data/templates/types";

interface AIAssistantWidgetProps {
  /** Whether the widget is open */
  isOpen: boolean;
  /** Callback to close the widget */
  onClose: () => void;
  /** Current template code for context */
  currentCode?: string;
  /** System type for context */
  systemType?: BusinessSystemType | null;
  /** Template/business name */
  templateName?: string | null;
  /** Callback when code is generated */
  onCodeGenerated?: (code: string) => void;
  /** Callback when code should be applied to preview */
  onApplyCode?: (code: string) => void;
  /** Selected element context for targeted edits */
  selectedElement?: {
    html: string;
    selector: string;
    section?: string;
  };
  /** Position of the widget */
  position?: "right" | "left" | "bottom-right";
}

// Quick actions for the web builder widget
const getBuilderQuickActions = (hasSelectedElement: boolean): QuickAction[] => {
  if (hasSelectedElement) {
    return [
      {
        id: "improve-section",
        label: "Improve this",
        prompt: "Improve this section with better styling and content",
        icon: <Wand2 className="w-3 h-3" />,
      },
      {
        id: "add-animation",
        label: "Add animation",
        prompt: "Add smooth CSS animations to this element",
        icon: <Sparkles className="w-3 h-3" />,
      },
      {
        id: "change-colors",
        label: "Change colors",
        prompt: "Update the colors to be more modern and vibrant",
        icon: <Palette className="w-3 h-3" />,
      },
      {
        id: "make-responsive",
        label: "Make responsive",
        prompt: "Make this section fully responsive for mobile devices",
        icon: <RefreshCw className="w-3 h-3" />,
      },
    ];
  }

  return [
    {
      id: "add-hero",
      label: "Add Hero",
      prompt: "Add a hero section with headline, subheadline, and CTA buttons",
      icon: <Zap className="w-3 h-3" />,
    },
    {
      id: "add-features",
      label: "Add Features",
      prompt: "Add a features section with 3 feature cards and icons",
      icon: <Code2 className="w-3 h-3" />,
    },
    {
      id: "add-testimonials",
      label: "Testimonials",
      prompt: "Add a testimonials section with customer reviews",
      icon: <Sparkles className="w-3 h-3" />,
    },
    {
      id: "full-ai-transform",
      label: "🚀 Full AI Transform",
      prompt: "Take full control and transform this entire page with modern design, animations, and optimized structure",
      icon: <Wand2 className="w-3 h-3" />,
    },
  ];
};

export const AIAssistantWidget: React.FC<AIAssistantWidgetProps> = ({
  isOpen,
  onClose,
  currentCode,
  systemType,
  templateName,
  onCodeGenerated,
  onApplyCode,
  selectedElement,
  position = "right",
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isOpen) return null;

  const hasSelectedElement = !!selectedElement;
  const quickActions = getBuilderQuickActions(hasSelectedElement);

  // Build context for the AI
  const contextCode = selectedElement 
    ? `<!-- Selected element (${selectedElement.section || 'element'}): -->\n${selectedElement.html}\n\n<!-- Full page context: -->\n${currentCode || ''}`
    : currentCode;

  const handleCodeGenerated = (code: string) => {
    onCodeGenerated?.(code);
    onApplyCode?.(code);
  };

  // Position classes
  const positionClasses = {
    right: "right-0 top-0 bottom-0",
    left: "left-0 top-0 bottom-0",
    "bottom-right": "right-4 bottom-4",
  };

  // Size classes
  const sizeClasses = isExpanded
    ? "w-[500px] h-[600px]"
    : isMinimized
    ? "w-80 h-12"
    : "w-96 h-[500px]";

  return (
    <div
      className={cn(
        "fixed z-50 bg-background border shadow-2xl flex flex-col transition-all duration-200",
        position === "bottom-right" ? "rounded-lg" : "border-l",
        positionClasses[position],
        sizeClasses
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-purple-600 to-blue-600 text-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          <span className="font-semibold text-sm">
            {hasSelectedElement ? "Edit Element" : "AI Assistant"}
          </span>
          {hasSelectedElement && selectedElement.section && (
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
              {selectedElement.section}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-white/80 hover:text-white hover:bg-white/20 h-7 w-7"
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-white/80 hover:text-white hover:bg-white/20 h-7 w-7"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 h-7 w-7"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <AIAssistantCore
          className="flex-1 border-0 rounded-none"
          placeholder={
            hasSelectedElement
              ? `Describe how to edit this ${selectedElement.section || 'element'}...`
              : "Describe what you want to add or change..."
          }
          quickActions={quickActions}
          onCodeGenerated={handleCodeGenerated}
          contextCode={contextCode}
          systemType={systemType || undefined}
          businessName={templateName || undefined}
          showFileUpload={true}
          allowClearHistory={true}
          hideHeader={true}
          compact={!isExpanded}
        />
      )}
    </div>
  );
};

export default AIAssistantWidget;
