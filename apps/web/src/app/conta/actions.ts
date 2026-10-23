'use server';

import { getVerifiedAuthUser } from '@compra-car/adapter-supabase';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getAccountTier } from '@/auth/account-tier-server';
import { createMutableServerClient } from '@/auth/server-client';

function field(form: FormData, key: string, max: number): string | null {
  const value = form.get(key);
  if (typeof value !== 'string' || value.length > max) return null;
  return value.trim();
}

export async function updateContactProfile(form: FormData): Promise<never> {
  const phone = field(form, 'phone', 40);
  const company = field(form, 'company', 160);
  const jobTitle = field(form, 'jobTitle', 120);
  if (phone === null || company === null || jobTitle === null) {
    redirect('/conta/perfil?error=invalid');
  }
  const client = await createMutableServerClient();
  const user = await getVerifiedAuthUser(client);
  if (!user) redirect('/login');
  const { error } = await client.from('profiles')
    .update({ phone: phone || null, company: company || null, job_title: jobTitle || null })
    .eq('id', user.id);
  if (error) redirect('/conta/perfil?error=save');
  revalidatePath('/conta/perfil');
  redirect('/conta/perfil?saved=1');
}

export async function requestCorporateUpgrade(form: FormData): Promise<never> {
  const tier = await getAccountTier();
  if (tier !== 'public') redirect('/conta/plano');
  const company = field(form, 'company', 160);
  const jobTitle = field(form, 'jobTitle', 120);
  const contactPhone = field(form, 'phone', 40);
  const message = field(form, 'message', 1500);
  if (!company || company.length < 2 || !jobTitle || jobTitle.length < 2 ||
    !contactPhone || contactPhone.length < 6 || message === null) {
    redirect('/conta/upgrade?error=invalid');
  }
  const client = await createMutableServerClient();
  const user = await getVerifiedAuthUser(client);
  if (!user) redirect('/login');
  const { error } = await client.from('account_upgrade_requests').insert({
    user_id: user.id, company, job_title: jobTitle, contact_phone: contactPhone,
    message: message || null,
  });
  if (error) redirect('/conta/upgrade?error=save');
  revalidatePath('/conta/upgrade');
  redirect('/conta/upgrade?requested=1');
}
