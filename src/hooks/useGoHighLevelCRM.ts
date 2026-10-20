import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  customFields?: Record<string, unknown>[];
}

interface Location {
  id: string;
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
}

interface TemplateData {
  contact?: Contact;
  location?: Location;
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessLogo?: string;
  customFieldValues?: Record<string, unknown>[];
  customFieldDefinitions?: Record<string, unknown>[];
}

export function useGoHighLevelCRM(projectId?: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callCRM = useCallback(async (action: string, params: Record<string, unknown> = {}) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('gohighlevel-crm', {
        body: { action, projectId, ...params }
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'CRM request failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const getContact = useCallback(async (contactId: string) => {
    return callCRM('getContact', { contactId });
  }, [callCRM]);

  const getContacts = useCallback(async (locationId: string) => {
    return callCRM('getContacts', { locationId });
  }, [callCRM]);

  const getCustomFields = useCallback(async (locationId: string) => {
    return callCRM('getCustomFields', { locationId });
  }, [callCRM]);

  const getLocation = useCallback(async (locationId: string) => {
    return callCRM('getLocation', { locationId });
  }, [callCRM]);

  const getTemplateData = useCallback(async (params: { contactId?: string; locationId?: string }): Promise<TemplateData> => {
    return callCRM('getTemplateData', params);
  }, [callCRM]);

  return {
    loading,
    error,
    getContact,
    getContacts,
    getCustomFields,
    getLocation,
    getTemplateData,
  };
}
