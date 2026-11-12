/**
 * Team Management Service
 * 
 * Enterprise-grade team/organization management with:
 * - Member invitations
 * - Role management  
 * - Permission control
 * - Owner transfer
 * - Quota enforcement
 * - Audit logging
 */

import { supabase } from '@/integrations/supabase/client';
import { auditLogger } from '@/services/auditLogger';

export type TeamRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer' | 'billing';

export interface TeamMember {
  id: string;
  userId: string;
  organizationId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: TeamRole;
  title: string | null;
  department: string | null;
  isActive: boolean;
  joinedAt: string;
  invitedBy: string | null;
  lastActiveAt: string | null;
}

export interface TeamInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  inviterName: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  ownerId: string;
  memberCount: number;
  projectCount: number;
  status: 'active' | 'suspended' | 'trial' | 'canceled';
  plan: string;
  createdAt: string;
}

export interface InviteMemberInput {
  email: string;
  role: TeamRole;
  title?: string;
  department?: string;
  sendEmail?: boolean;
}

export interface UpdateMemberInput {
  role?: TeamRole;
  title?: string;
  department?: string;
  isActive?: boolean;
}

const ROLE_HIERARCHY: Record<TeamRole, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  member: 40,
  billing: 30,
  viewer: 20,
};

class TeamService {
  private organizationMembersTableAvailable: boolean | null = null;

  private isOrganizationMembersMissingError(error: { message?: string } | null | undefined): boolean {
    const message = error?.message || '';
    return message.includes("Could not find the table 'public.organization_members'") || message.includes('schema cache');
  }

  private async hasOrganizationMembersTable(): Promise<boolean> {
    if (this.organizationMembersTableAvailable !== null) {
      return this.organizationMembersTableAvailable;
    }

    const { error } = await supabase
      .from('organization_members')
      .select('id')
      .limit(1);

    if (error && this.isOrganizationMembersMissingError(error)) {
      this.organizationMembersTableAvailable = false;
      return false;
    }

    this.organizationMembersTableAvailable = true;
    return true;
  }

  /**
   * Get current user's organizations
   */
  async getMyOrganizations(): Promise<Organization[]> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return [];
    }

    const hasMembershipTable = await this.hasOrganizationMembersTable();

    // Fallback for schemas that do not include organization_members.
    if (!hasMembershipTable) {
      const { data: ownedOrganizations, error: ownedError } = await supabase
        .from('organizations')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (ownedError || !ownedOrganizations) {
        console.error('Error fetching organizations (fallback):', ownedError);
        return [];
      }

      return ownedOrganizations.map((org) => ({
        id: org.id as string,
        name: org.name as string,
        slug: org.slug as string,
        description: org.description as string | null,
        logoUrl: org.logo as string | null,
        ownerId: org.owner_id as string,
        memberCount: (org.member_count as number) ?? 1,
        projectCount: (org.project_count as number) ?? 0,
        status: (org.status as 'active' | 'suspended' | 'trial' | 'canceled') ?? 'active',
        plan: 'free',
        createdAt: org.created_at as string,
      }));
    }

    // Get organizations where user is a member
    const { data: memberships, error } = await supabase
      .from('organization_members')
      .select(`
        organization_id,
        role,
        organizations:organization_id (
          id,
          name,
          slug,
          description,
          logo,
          owner_id,
          member_count,
          project_count,
          status,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (error || !memberships) {
      console.error('Error fetching organizations:', error);
      return [];
    }

    return memberships
      .filter((m) => m.organizations)
      .map((m) => {
        const org = m.organizations as unknown as Record<string, unknown>;
        return {
          id: org.id as string,
          name: org.name as string,
          slug: org.slug as string,
          description: org.description as string | null,
          logoUrl: org.logo as string | null,
          ownerId: org.owner_id as string,
          memberCount: (org.member_count as number) ?? 0,
          projectCount: (org.project_count as number) ?? 0,
          status: (org.status as 'active' | 'suspended' | 'trial' | 'canceled') ?? 'active',
          plan: 'free', // Would come from billing
          createdAt: org.created_at as string,
        };
      });
  }

  /**
   * Get organization by ID
   */
  async getOrganization(orgId: string): Promise<Organization | null> {
    const { data: org, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    if (error || !org) {
      return null;
    }

    return {
      id: org.id as string,
      name: org.name as string,
      slug: org.slug as string,
      description: org.description as string | null,
      logoUrl: org.logo as string | null,
      ownerId: org.owner_id as string,
      memberCount: (org.member_count as number) ?? 0,
      projectCount: (org.project_count as number) ?? 0,
      status: (org.status as 'active' | 'suspended' | 'trial' | 'canceled') ?? 'active',
      plan: 'free',
      createdAt: org.created_at as string,
    };
  }

  /**
   * Get all members of an organization
   */
  async getMembers(organizationId: string): Promise<TeamMember[]> {
    if (!(await this.hasOrganizationMembersTable())) {
      return [];
    }

    const { data: members, error } = await supabase
      .from('organization_members')
      .select(`
        id,
        user_id,
        organization_id,
        role,
        title,
        department,
        is_active,
        joined_at,
        invited_by,
        profiles:user_id (
          full_name,
          avatar_url
        ),
        users:user_id (
          email,
          last_sign_in_at
        )
      `)
      .eq('organization_id', organizationId)
      .order('joined_at', { ascending: true });

    if (error || !members) {
      console.error('Error fetching members:', error);
      return [];
    }

    return members.map((m) => {
      const profile = (m.profiles as unknown as Record<string, unknown>) ?? {};
      const userInfo = (m.users as unknown as Record<string, unknown>) ?? {};
      
      return {
        id: m.id as string,
        userId: m.user_id as string,
        organizationId: m.organization_id as string,
        email: (userInfo.email as string) ?? '',
        fullName: (profile.full_name as string) ?? null,
        avatarUrl: (profile.avatar_url as string) ?? null,
        role: m.role as TeamRole,
        title: m.title as string | null,
        department: m.department as string | null,
        isActive: m.is_active as boolean,
        joinedAt: m.joined_at as string,
        invitedBy: m.invited_by as string | null,
        lastActiveAt: (userInfo.last_sign_in_at as string) ?? null,
      };
    });
  }

  /**
   * Get current user's role in an organization
   */
  async getMyRole(organizationId: string): Promise<TeamRole | null> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return null;
    }

    if (!(await this.hasOrganizationMembersTable())) {
      const org = await this.getOrganization(organizationId);
      return org?.ownerId === user.id ? 'owner' : null;
    }

    const { data, error } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return null;
    }

    return data.role as TeamRole;
  }

  /**
   * Check if current user can perform an action
   */
  async canPerform(organizationId: string, requiredRole: TeamRole): Promise<boolean> {
    const myRole = await this.getMyRole(organizationId);
    
    if (!myRole) {
      return false;
    }

    return ROLE_HIERARCHY[myRole] >= ROLE_HIERARCHY[requiredRole];
  }

  /**
   * Invite a new member to the organization
   */
  async inviteMember(
    organizationId: string, 
    input: InviteMemberInput
  ): Promise<{ success: boolean; invitationId?: string; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!(await this.hasOrganizationMembersTable())) {
      return { success: false, error: 'Team memberships are not configured for this project schema yet' };
    }

    // Check permission
    const canInvite = await this.canPerform(organizationId, 'admin');
    if (!canInvite) {
      return { success: false, error: 'You do not have permission to invite members' };
    }

    // Check quota
    const quota = await this.checkMemberQuota(organizationId);
    if (!quota.allowed) {
      return { success: false, error: quota.message ?? 'Member limit reached' };
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', input.email.toLowerCase())
      .single();

    if (existingUser) {
      // Check if already a member
      const { data: existingMember } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', existingUser.id)
        .single();

      if (existingMember) {
        return { success: false, error: 'User is already a member of this organization' };
      }
      // Never add an account directly by email: the person must accept the
      // invitation from their own confirmed mailbox before they get access.
    }

    // Create pending invitation
    const { data: invitation, error } = await supabase
      .from('team_invitations')
      .insert({
        organization_id: organizationId,
        email: input.email.toLowerCase(),
        role: input.role,
        invited_by: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .select('id')
      .single();

    if (error) {
      // If invitations table doesn't exist, create a simple member record
      // This is a fallback for simpler setups
      console.warn('team_invitations table not found, creating pending member');
      return { success: false, error: 'Invitation system not configured' };
    }

    // Send invitation email via Edge Function
    if (input.sendEmail !== false) {
      await supabase.functions.invoke('send-invitation', {
        body: {
          invitationId: invitation.id,
          email: input.email,
          organizationId,
        },
      });
    }

    await auditLogger.log({
      action: 'create',
      resourceType: 'organization',
      resourceId: organizationId,
      metadata: {
        event: 'invitation_sent',
        inviteeEmail: input.email,
        role: input.role,
      },
    });

    return { success: true, invitationId: invitation.id };
  }

  /**
   * Update a team member's role or details
   */
  async updateMember(
    organizationId: string,
    memberId: string,
    input: UpdateMemberInput
  ): Promise<{ success: boolean; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!(await this.hasOrganizationMembersTable())) {
      return { success: false, error: 'Team memberships are not configured for this project schema yet' };
    }

    // Check permission
    const canManage = await this.canPerform(organizationId, 'admin');
    if (!canManage) {
      return { success: false, error: 'You do not have permission to manage members' };
    }

    // Get target member
    const { data: member, error: fetchError } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !member) {
      return { success: false, error: 'Member not found' };
    }

    // Cannot demote owner
    if (member.role === 'owner' && input.role && input.role !== 'owner') {
      return { success: false, error: 'Cannot demote the organization owner' };
    }

    // Cannot elevate to owner via this method
    if (input.role === 'owner') {
      return { success: false, error: 'Use transferOwnership to change owner' };
    }

    const { error } = await supabase
      .from('organization_members')
      .update({
        role: input.role,
        title: input.title,
        department: input.department,
        is_active: input.isActive,
      })
      .eq('id', memberId);

    if (error) {
      return { success: false, error: error.message };
    }

    await auditLogger.log({
      action: 'update',
      resourceType: 'organization',
      resourceId: organizationId,
      metadata: {
        event: 'member_updated',
        memberId,
        changes: input,
      },
    });

    return { success: true };
  }

  /**
   * Remove a member from the organization
   */
  async removeMember(
    organizationId: string,
    memberId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!(await this.hasOrganizationMembersTable())) {
      return { success: false, error: 'Team memberships are not configured for this project schema yet' };
    }

    // Check permission
    const canManage = await this.canPerform(organizationId, 'admin');
    if (!canManage) {
      return { success: false, error: 'You do not have permission to remove members' };
    }

    // Get target member
    const { data: member, error: fetchError } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError || !member) {
      return { success: false, error: 'Member not found' };
    }

    // Cannot remove owner
    if (member.role === 'owner') {
      return { success: false, error: 'Cannot remove the organization owner' };
    }

    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      return { success: false, error: error.message };
    }

    await auditLogger.log({
      action: 'delete',
      resourceType: 'organization',
      resourceId: organizationId,
      metadata: {
        event: 'member_removed',
        memberId,
        userId: member.user_id,
      },
    });

    return { success: true };
  }

  /**
   * Transfer organization ownership
   */
  async transferOwnership(
    organizationId: string,
    newOwnerId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!(await this.hasOrganizationMembersTable())) {
      return { success: false, error: 'Team memberships are not configured for this project schema yet' };
    }

    // Only current owner can transfer
    const org = await this.getOrganization(organizationId);
    if (!org || org.ownerId !== user.id) {
      return { success: false, error: 'Only the owner can transfer ownership' };
    }

    // Verify new owner is a member
    const { data: newOwnerMember, error: memberError } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', newOwnerId)
      .single();

    if (memberError || !newOwnerMember) {
      return { success: false, error: 'New owner must be a member of the organization' };
    }

    // Update organization owner
    const { error: orgError } = await supabase
      .from('organizations')
      .update({ owner_id: newOwnerId })
      .eq('id', organizationId);

    if (orgError) {
      return { success: false, error: orgError.message };
    }

    // Update member roles
    await supabase
      .from('organization_members')
      .update({ role: 'owner' })
      .eq('organization_id', organizationId)
      .eq('user_id', newOwnerId);

    await supabase
      .from('organization_members')
      .update({ role: 'admin' })
      .eq('organization_id', organizationId)
      .eq('user_id', user.id);

    await auditLogger.logSecurityEvent('permission_change', {
      event: 'ownership_transferred',
      organizationId,
      previousOwner: user.id,
      newOwner: newOwnerId,
    }, 'high');

    return { success: true };
  }

  /**
   * Leave an organization (self-remove)
   */
  async leaveOrganization(organizationId: string): Promise<{ success: boolean; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!(await this.hasOrganizationMembersTable())) {
      return { success: false, error: 'Team memberships are not configured for this project schema yet' };
    }

    const myRole = await this.getMyRole(organizationId);
    
    if (myRole === 'owner') {
      return { success: false, error: 'Owner cannot leave. Transfer ownership first.' };
    }

    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('organization_id', organizationId)
      .eq('user_id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    await auditLogger.log({
      action: 'delete',
      resourceType: 'organization',
      resourceId: organizationId,
      metadata: { event: 'member_left' },
    });

    return { success: true };
  }

  /**
   * Create a new organization
   */
  async createOrganization(
    name: string,
    slug?: string
  ): Promise<{ organization?: Organization; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { error: 'Not authenticated' };
    }

    // Generate slug if not provided
    const orgSlug = slug ?? name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name,
        slug: orgSlug,
        owner_id: user.id,
        member_count: 1,
      })
      .select()
      .single();

    if (orgError) {
      if (orgError.message.includes('duplicate')) {
        return { error: 'An organization with this name already exists' };
      }
      return { error: orgError.message };
    }

    // Add creator as owner member
    if (await this.hasOrganizationMembersTable()) {
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: org.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) {
        console.error('Error adding owner as member:', memberError);
      }
    }

    await auditLogger.log({
      action: 'create',
      resourceType: 'organization',
      resourceId: org.id as string,
      resourceName: name,
    });

    return {
      organization: {
        id: org.id as string,
        name: org.name as string,
        slug: org.slug as string,
        description: null,
        logoUrl: null,
        ownerId: user.id,
        memberCount: 1,
        projectCount: 0,
        status: 'active',
        plan: 'free',
        createdAt: org.created_at as string,
      },
    };
  }

  /**
   * Check member quota for organization
   */
  private async checkMemberQuota(organizationId: string): Promise<{ allowed: boolean; message?: string }> {
    // Check organization_quotas table
    const { data: quota } = await supabase
      .from('organization_quotas')
      .select('max_team_members')
      .eq('organization_id', organizationId)
      .single();

    const { data: usage } = await supabase
      .from('organization_usage')
      .select('team_members_count')
      .eq('organization_id', organizationId)
      .single();

    if (quota && usage) {
      const max = quota.max_team_members as number;
      const current = usage.team_members_count as number;
      
      if (current >= max) {
        return { 
          allowed: false, 
          message: `Team member limit reached (${current}/${max}). Upgrade to add more.` 
        };
      }
    }

    return { allowed: true };
  }
}

export const teamService = new TeamService();

// React hooks
import { useState, useEffect, useCallback } from 'react';

export function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const orgs = await teamService.getMyOrganizations();
      setOrganizations(orgs);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { organizations, loading, error, refresh: fetch };
}

export function useTeamMembers(organizationId: string | null) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!organizationId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const m = await teamService.getMembers(organizationId);
      setMembers(m);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const inviteMember = async (input: InviteMemberInput) => {
    if (!organizationId) return { success: false, error: 'No organization selected' };
    const result = await teamService.inviteMember(organizationId, input);
    if (result.success) await fetch();
    return result;
  };

  const updateMember = async (memberId: string, input: UpdateMemberInput) => {
    if (!organizationId) return { success: false, error: 'No organization selected' };
    const result = await teamService.updateMember(organizationId, memberId, input);
    if (result.success) await fetch();
    return result;
  };

  const removeMember = async (memberId: string) => {
    if (!organizationId) return { success: false, error: 'No organization selected' };
    const result = await teamService.removeMember(organizationId, memberId);
    if (result.success) await fetch();
    return result;
  };

  return {
    members,
    loading,
    error,
    inviteMember,
    updateMember,
    removeMember,
    refresh: fetch,
  };
}

export function useMyRole(organizationId: string | null) {
  const [role, setRole] = useState<TeamRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) {
      setRole(null);
      setLoading(false);
      return;
    }

    teamService.getMyRole(organizationId).then((r) => {
      setRole(r);
      setLoading(false);
    });
  }, [organizationId]);

  const canManageMembers = role ? ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.admin : false;
  const canManageSettings = role ? ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.admin : false;
  const canViewBilling = role ? ['owner', 'admin', 'billing'].includes(role) : false;
  const isOwner = role === 'owner';

  return { role, loading, canManageMembers, canManageSettings, canViewBilling, isOwner };
}
