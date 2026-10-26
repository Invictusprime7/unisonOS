/**
 * WorkflowListPanel Component
 * 
 * Panel showing list of workflows with ability to create, edit, and manage them.
 * Opens WorkflowBuilder in a dialog for editing.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Play,
  Pause,
  Pencil,
  Copy,
  Trash2,
  Workflow as WorkflowIcon,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { WorkflowBuilder } from './workflow-builder';
import type { Workflow } from './workflow-builder/types';
import {
  listWorkflows,
  saveWorkflow,
  deleteWorkflow,
  duplicateWorkflow,
  toggleWorkflowActive,
  loadWorkflow,
} from '@/services/workflowBuilderService';

interface WorkflowListPanelProps {
  businessId?: string;
  projectId?: string;
  industry?: string;
}

export function WorkflowListPanel({
  businessId,
  projectId,
  industry,
}: WorkflowListPanelProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog state
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Load workflows
  const fetchWorkflows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    const { workflows: data, error: fetchError } = await listWorkflows({ businessId: businessId || '', projectId });
    
    if (fetchError) {
      setError(fetchError);
    } else {
      setWorkflows(data);
    }
    
    setIsLoading(false);
  }, [businessId, projectId]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Create new workflow
  const handleCreate = useCallback(() => {
    setEditingWorkflow(null);
    setIsBuilderOpen(true);
  }, []);

  // Edit workflow
  const handleEdit = useCallback(async (workflowId: string) => {
    const { workflow, error: loadError } = await loadWorkflow(workflowId, { businessId: businessId || '', projectId });
    if (loadError || !workflow) {
      toast.error('Failed to load workflow');
      return;
    }
    setEditingWorkflow(workflow);
    setIsBuilderOpen(true);
  }, [businessId, projectId]);

  // Save workflow from builder
  const handleSave = useCallback(async (workflow: Workflow) => {
    const { success, id, error: saveError } = await saveWorkflow(workflow, { businessId: businessId || '', projectId });
    
    if (!success || saveError) {
      throw new Error(saveError || 'Save failed');
    }
    
    // Update local state
    if (editingWorkflow) {
      setWorkflows(prev => prev.map(w => w.id === workflow.id ? { ...workflow, id: id || workflow.id } : w));
    } else {
      setWorkflows(prev => [{ ...workflow, id: id || workflow.id }, ...prev]);
    }
    
    setIsBuilderOpen(false);
    setEditingWorkflow(null);
  }, [businessId, projectId, editingWorkflow]);

  // Toggle active
  const handleToggleActive = useCallback(async (workflowId: string, currentActive: boolean) => {
    const { success, error: toggleError } = await toggleWorkflowActive(workflowId, !currentActive, { businessId: businessId || '', projectId });
    
    if (success) {
      setWorkflows(prev => prev.map(w => 
        w.id === workflowId ? { ...w, isActive: !currentActive } : w
      ));
      toast.success(currentActive ? 'Workflow paused' : 'Workflow activated');
    } else {
      toast.error(toggleError || 'Failed to toggle workflow');
    }
  }, [businessId, projectId]);

  // Duplicate
  const handleDuplicate = useCallback(async (workflowId: string) => {
    const { workflow, error: dupError } = await duplicateWorkflow(workflowId, { businessId: businessId || '', projectId });
    
    if (workflow) {
      setWorkflows(prev => [workflow, ...prev]);
      toast.success('Workflow duplicated');
    } else {
      toast.error(dupError || 'Failed to duplicate workflow');
    }
  }, [businessId, projectId]);

  // Delete
  const handleDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    
    const { success, error: deleteError } = await deleteWorkflow(deleteConfirmId, { businessId: businessId || '', projectId });
    
    if (success) {
      setWorkflows(prev => prev.filter(w => w.id !== deleteConfirmId));
      toast.success('Workflow deleted');
    } else {
      toast.error(deleteError || 'Failed to delete workflow');
    }
    
    setDeleteConfirmId(null);
  }, [businessId, deleteConfirmId, projectId]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <AlertCircle className="w-8 h-8 text-destructive mb-2" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={fetchWorkflows}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <WorkflowIcon className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-medium text-foreground">Workflows</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {workflows.length}
          </Badge>
        </div>
        <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={handleCreate}>
          <Plus className="w-3 h-3 mr-1" />
          New
        </Button>
      </div>

      {/* Workflow List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {workflows.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <WorkflowIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No workflows yet</p>
              <p className="text-xs mt-1">Create your first automation workflow</p>
              <Button size="sm" className="mt-4" onClick={handleCreate}>
                <Plus className="w-3 h-3 mr-1" />
                Create Workflow
              </Button>
            </div>
          ) : (
            workflows.map(workflow => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onEdit={() => handleEdit(workflow.id)}
                onToggleActive={() => handleToggleActive(workflow.id, workflow.isActive)}
                onDuplicate={() => handleDuplicate(workflow.id)}
                onDelete={() => setDeleteConfirmId(workflow.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Workflow Builder Dialog */}
      <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-[1400px] h-[800px] p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {editingWorkflow ? `Edit: ${editingWorkflow.name}` : 'New Workflow'}
            </DialogTitle>
          </DialogHeader>
          <WorkflowBuilder
            workflowId={editingWorkflow?.id}
            projectId={projectId}
            industry={industry}
            onSave={handleSave}
            onClose={() => setIsBuilderOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the workflow and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============ WORKFLOW CARD ============

interface WorkflowCardProps {
  workflow: Workflow;
  onEdit: () => void;
  onToggleActive: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function WorkflowCard({
  workflow,
  onEdit,
  onToggleActive,
  onDuplicate,
  onDelete,
}: WorkflowCardProps) {
  const triggerNode = workflow.nodes.find(n => n.type === 'trigger');
  const actionCount = workflow.nodes.filter(n => n.type === 'action').length;

  return (
    <div className="bg-card/50 border border-border/50 rounded-lg p-3 hover:border-purple-500/30 transition-colors group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-foreground truncate">
              {workflow.name}
            </h4>
            {workflow.isActive ? (
              <Badge className="bg-green-500/20 text-green-400 text-[10px] px-1.5 py-0">
                Active
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Paused
              </Badge>
            )}
          </div>
          {workflow.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {workflow.description}
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={(e) => { e.stopPropagation(); onToggleActive(); }}
            title={workflow.isActive ? 'Pause' : 'Activate'}
          >
            {workflow.isActive ? (
              <Pause className="w-3 h-3" />
            ) : (
              <Play className="w-3 h-3" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            title="Edit"
          >
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            title="Duplicate"
          >
            <Copy className="w-3 h-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        {triggerNode && (
          <span className="capitalize">
            Trigger: {triggerNode.config.triggerType?.replace(/[._]/g, ' ') || 'Not set'}
          </span>
        )}
        <span>{actionCount} action{actionCount !== 1 ? 's' : ''}</span>
        <span>{workflow.nodes.length} total steps</span>
      </div>

      {/* Click area for edit */}
      <div 
        className="absolute inset-0 cursor-pointer" 
        onClick={onEdit}
        style={{ zIndex: -1 }}
      />
    </div>
  );
}
