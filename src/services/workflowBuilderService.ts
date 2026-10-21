/**
 * Workflow Builder Service
 * 
 * Handles saving, loading, and managing workflows in the database.
 * Converts between visual builder format and database format.
 */

import { applyResourceOp, getResourceRecord, queryResource } from '@/services/resources/resourceRuntime';
import type { Workflow, WorkflowNode, WorkflowEdge } from '@/components/creatives/web-builder/workflow-builder/types';
import type { ResourceContext } from '@/services/resources/resourceTypes';

export interface WorkflowScope {
  businessId: string;
  projectId?: string;
}

function resourceContext(scope: WorkflowScope): ResourceContext {
  return { ...scope, mode: 'cloud' };
}

// ============ TYPES ============

export interface DbWorkflow {
  id: string;
  name: string;
  description?: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  steps: DbWorkflowStep[];
  is_active: boolean;
  user_id?: string;
  project_id?: string;
  industry?: string;
  created_at: string;
  updated_at: string;
}

export interface DbWorkflowStep {
  action_type: string;
  config: Record<string, unknown>;
  wait_duration?: string;
  condition?: {
    field: string;
    operator: string;
    value: string;
  };
}

// ============ CONVERTERS ============

/**
 * Convert visual workflow format to database format
 */
export function workflowToDbFormat(workflow: Workflow): Omit<DbWorkflow, 'id' | 'created_at' | 'updated_at' | 'user_id'> {
  // Find the trigger node
  const triggerNode = workflow.nodes.find(n => n.type === 'trigger');
  
  // Build ordered steps based on edges
  const steps: DbWorkflowStep[] = [];
  const visited = new Set<string>();
  
  // Start from trigger and traverse
  function traverseFromNode(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const node = workflow.nodes.find(n => n.id === nodeId);
    if (!node || node.type === 'trigger') {
      // Skip trigger, but continue traversal
      const outgoingEdges = workflow.edges.filter(e => e.sourceId === nodeId);
      outgoingEdges.forEach(edge => traverseFromNode(edge.targetId));
      return;
    }
    
    // Convert node to step
    const step: DbWorkflowStep = {
      action_type: node.type === 'action' 
        ? node.config.actionType || 'unknown'
        : node.type,
      config: { ...node.config, label: node.label },
    };
    
    if (node.type === 'wait') {
      step.wait_duration = node.config.waitDuration;
    }
    
    if (node.type === 'condition' && node.config.conditionField) {
      step.condition = {
        field: node.config.conditionField,
        operator: node.config.conditionOperator || 'equals',
        value: node.config.conditionValue || '',
      };
    }
    
    steps.push(step);
    
    // Continue traversal
    const outgoingEdges = workflow.edges.filter(e => e.sourceId === nodeId);
    outgoingEdges.forEach(edge => traverseFromNode(edge.targetId));
  }
  
  if (triggerNode) {
    traverseFromNode(triggerNode.id);
  }
  
  return {
    name: workflow.name,
    description: workflow.description,
    trigger_type: triggerNode?.config.triggerType || 'manual',
    trigger_config: triggerNode?.config.triggerConditions || {},
    steps,
    is_active: workflow.isActive,
    project_id: workflow.projectId ?? undefined,
    industry: workflow.industry,
  };
}

/**
 * Convert database format to visual workflow format
 */
export function dbFormatToWorkflow(dbWorkflow: DbWorkflow): Workflow {
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];
  
  // Create trigger node
  const triggerNodeId = `node_trigger_${Date.now()}`;
  nodes.push({
    id: triggerNodeId,
    type: 'trigger',
    label: 'Trigger',
    position: { x: 100, y: 100 },
    config: {
      triggerType: dbWorkflow.trigger_type as WorkflowNode['config']['triggerType'],
      triggerConditions: dbWorkflow.trigger_config,
    },
    isStart: true,
  });
  
  let prevNodeId = triggerNodeId;
  let xOffset = 350;
  
  // Create nodes for each step
  dbWorkflow.steps.forEach((step, index) => {
    const nodeId = `node_${index}_${Date.now()}`;
    
    // Determine node type
    let nodeType: WorkflowNode['type'] = 'action';
    if (step.action_type === 'wait') {
      nodeType = 'wait';
    } else if (step.action_type === 'condition' || step.condition) {
      nodeType = 'condition';
    } else if (step.action_type === 'goal') {
      nodeType = 'goal';
    }
    
    const node: WorkflowNode = {
      id: nodeId,
      type: nodeType,
      label: (step.config.label as string) || `Step ${index + 1}`,
      position: { x: xOffset, y: 100 },
      config: {
        ...step.config,
        actionType: nodeType === 'action' ? step.action_type as WorkflowNode['config']['actionType'] : undefined,
        waitDuration: step.wait_duration,
        conditionField: step.condition?.field,
        conditionOperator: step.condition?.operator as WorkflowNode['config']['conditionOperator'],
        conditionValue: step.condition?.value,
      },
    };
    
    nodes.push(node);
    
    // Create edge from previous node
    edges.push({
      id: `edge_${index}_${Date.now()}`,
      sourceId: prevNodeId,
      targetId: nodeId,
    });
    
    prevNodeId = nodeId;
    xOffset += 250;
  });
  
  return {
    id: dbWorkflow.id,
    name: dbWorkflow.name,
    description: dbWorkflow.description,
    nodes,
    edges,
    isActive: dbWorkflow.is_active,
    createdAt: dbWorkflow.created_at,
    updatedAt: dbWorkflow.updated_at,
    projectId: dbWorkflow.project_id ?? undefined,
    industry: dbWorkflow.industry,
  };
}

// ============ API FUNCTIONS ============

/**
 * Save workflow to database
 */
export async function saveWorkflow(workflow: Workflow, scope: WorkflowScope): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const dbFormat = workflowToDbFormat(workflow);

    if (workflow.id && !workflow.id.startsWith('wf_')) {
      await applyResourceOp({
        op: 'update',
        ref: { resourceKey: 'crm:workflows', kind: 'crm', recordId: workflow.id },
        values: dbFormat,
      }, resourceContext(scope));
      return { success: true, id: workflow.id };
    } else {
      const data = await applyResourceOp({
        op: 'create',
        resourceKey: 'crm:workflows',
        values: dbFormat,
      }, resourceContext(scope));
      return { success: true, id: data?.id };
    }
  } catch (error) {
    console.error('Error saving workflow:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Load workflow from database
 */
export async function loadWorkflow(workflowId: string, scope: WorkflowScope): Promise<{ workflow?: Workflow; error?: string }> {
  try {
    const data = await getResourceRecord('crm:workflows', resourceContext(scope), workflowId);
    if (!data) return { error: 'Workflow not found' };
    
    const workflow = dbFormatToWorkflow(data as unknown as DbWorkflow);
    return { workflow };
  } catch (error) {
    console.error('Error loading workflow:', error);
    return { error: (error as Error).message };
  }
}

/**
 * List workflows for a project
 */
export async function listWorkflows(scope: WorkflowScope): Promise<{ workflows: Workflow[]; error?: string }> {
  try {
    const rows = await queryResource('crm:workflows', resourceContext(scope));
    const workflows = rows.map(row => dbFormatToWorkflow(row as unknown as DbWorkflow));
    return { workflows };
  } catch (error) {
    console.error('Error listing workflows:', error);
    return { workflows: [], error: (error as Error).message };
  }
}

/**
 * Delete workflow
 */
export async function deleteWorkflow(workflowId: string, scope: WorkflowScope): Promise<{ success: boolean; error?: string }> {
  try {
    await applyResourceOp({
      op: 'delete',
      ref: { resourceKey: 'crm:workflows', kind: 'crm', recordId: workflowId },
    }, resourceContext(scope));
    return { success: true };
  } catch (error) {
    console.error('Error deleting workflow:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Duplicate workflow
 */
export async function duplicateWorkflow(workflowId: string, scope: WorkflowScope): Promise<{ workflow?: Workflow; error?: string }> {
  try {
    const { workflow, error: loadError } = await loadWorkflow(workflowId, scope);
    
    if (loadError || !workflow) {
      return { error: loadError || 'Workflow not found' };
    }
    
    // Create copy with new ID and name
    const copy: Workflow = {
      ...workflow,
      id: `wf_${Date.now()}`,
      name: `${workflow.name} (Copy)`,
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const { id, error: saveError } = await saveWorkflow(copy, scope);
    
    if (saveError) {
      return { error: saveError };
    }
    
    return { workflow: { ...copy, id: id || copy.id } };
  } catch (error) {
    console.error('Error duplicating workflow:', error);
    return { error: (error as Error).message };
  }
}

/**
 * Toggle workflow active status
 */
export async function toggleWorkflowActive(workflowId: string, isActive: boolean, scope: WorkflowScope): Promise<{ success: boolean; error?: string }> {
  try {
    await applyResourceOp({
      op: 'update',
      ref: { resourceKey: 'crm:workflows', kind: 'crm', recordId: workflowId },
      values: { is_active: isActive },
    }, resourceContext(scope));
    return { success: true };
  } catch (error) {
    console.error('Error toggling workflow:', error);
    return { success: false, error: (error as Error).message };
  }
}
