import 'server-only';

import { AdminUserAdapterConfigurationError } from '@compra-car/adapter-supabase';

function requiredHttpsUrl(name: string): string {
  const value = process.env[name]?.trim();
  if (!value)
    throw new AdminUserAdapterConfigurationError(`Missing required configuration: ${name}.`);
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) {
      throw new Error('unsafe protocol');
    }
    return url.toString();
  } catch (error) {
    throw new AdminUserAdapterConfigurationError(`Invalid URL configuration: ${name}.`, {
      cause: error,
    });
  }
}

export const getAdminInviteRedirectUrl = () => requiredHttpsUrl('AUTH_INVITE_REDIRECT_URL');
export const getAdminRecoveryRedirectUrl = () => requiredHttpsUrl('AUTH_RECOVERY_REDIRECT_URL');
