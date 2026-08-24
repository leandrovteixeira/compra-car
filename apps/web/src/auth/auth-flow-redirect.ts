import 'server-only';

import { getAdminInviteRedirectUrl, getAdminRecoveryRedirectUrl } from './admin-user-redirects';

type AuthFlow = 'invite' | 'recovery';

function configuredCallbackUrl(flow: AuthFlow): URL {
  return new URL(flow === 'invite' ? getAdminInviteRedirectUrl() : getAdminRecoveryRedirectUrl());
}

export function buildAuthFlowRedirect(flow: AuthFlow, valid: boolean): URL {
  const destination = configuredCallbackUrl(flow);
  destination.pathname = `/auth/${flow}`;
  destination.search = valid ? '' : '?error=invalid';
  destination.hash = '';
  return destination;
}

export function authFlowUsesSecureCookies(flow: AuthFlow): boolean {
  return configuredCallbackUrl(flow).protocol === 'https:';
}
