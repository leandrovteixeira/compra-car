const PUBLIC_PATHS = new Set(['/forgot-password', '/login']);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname === '/auth' || pathname.startsWith('/auth/');
}

export function requiresAuthentication(pathname: string): boolean {
  return !isPublicPath(pathname);
}
