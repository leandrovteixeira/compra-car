'use client';

import { createBrowserAuthClient } from '@compra-car/adapter-supabase';

import { getAuthClientConfig } from './config';

export function createBrowserClient() {
  return createBrowserAuthClient(getAuthClientConfig());
}
