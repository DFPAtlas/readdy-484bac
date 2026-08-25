'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type AdminRole = 'super_admin' | 'admin' | 'finance_admin';

export const VALID_ADMIN_ROLES: readonly AdminRole[] = ['super_admin', 'admin', 'finance_admin'];

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (VALID_ADMIN_ROLES as readonly string[]).includes(value);
}

interface AdminAuth {
  email: string;
  name: string;
  role: AdminRole | '';
  username: string;
}

let cachedUserId: string | null = null;
let cachedAdmin: AdminAuth | null = null;

export function useAdminAuth(): AdminAuth {
  const [admin, setAdmin] = useState<AdminAuth>(
    cachedAdmin || { email: '', name: '', role: '', username: '' }
  );

  useEffect(() => {
    if (cachedAdmin) {
      setAdmin(cachedAdmin);
      return;
    }

    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      if (cachedAdmin && cachedUserId === user.id) {
        setAdmin(cachedAdmin);
        return;
      }

      const { data } = await supabase
        .from('admin_users')
        .select('email, full_name, role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!cancelled && data) {
        const role = isAdminRole(data.role) ? data.role : '';
        const result: AdminAuth = {
          email: data.email || user.email || '',
          name: data.full_name || '',
          role,
          username: data.full_name || data.email || user.email || '',
        };
        cachedUserId = user.id;
        cachedAdmin = result;
        setAdmin(result);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return admin;
}

export function clearAdminAuthCache() {
  cachedUserId = null;
  cachedAdmin = null;
}