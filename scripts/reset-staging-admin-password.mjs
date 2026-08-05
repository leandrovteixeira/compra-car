import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import readline from 'node:readline';

const ENV_PATH = 'C:/Dev/compra-car/apps/web/.env.local';
const EXPECTED_URL = 'https://shfsjyjxmgwnlexmdkcs.supabase.co';

function readEnv(path) {
  const text = fs.readFileSync(path, 'utf8');
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const pos = line.indexOf('=');
        const key = line.slice(0, pos).trim();
        let value = line.slice(pos + 1).trim();

        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        return [key, value];
      }),
  );
}

const env = readEnv(ENV_PATH);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;

const secretKey =
  env.SUPABASE_SERVER_KEY ?? env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('URL do Supabase não encontrada no .env.local.');
}

if (!secretKey) {
  throw new Error('Nenhuma chave server-side do Supabase foi encontrada no .env.local.');
}

if (supabaseUrl !== EXPECTED_URL) {
  throw new Error(`ABORTADO: projeto diferente do Staging autorizado: ${supabaseUrl}`);
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

try {
  const email = String(await ask('E-mail do admin: ')).trim();

  console.log('\nLocalizando usuário no STAGING...');

  let page = 1;
  let targetUser = null;

  while (!targetUser) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw error;
    }

    targetUser = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

    if (targetUser || data.users.length < 100) {
      break;
    }

    page++;
  }

  if (!targetUser) {
    throw new Error(`Usuário não encontrado no Staging: ${email}`);
  }

  console.log(`Usuário encontrado: ${targetUser.email}`);
  console.log(`User ID: ${targetUser.id}`);

  const password = String(await ask('\nNova senha: '));
  const confirm = String(await ask('Digite ALTERAR para confirmar: ')).trim();

  if (confirm !== 'ALTERAR') {
    throw new Error('Operação cancelada.');
  }

  if (!password) {
    throw new Error('A nova senha não pode estar vazia.');
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(targetUser.id, {
    password,
  });

  if (updateError) {
    throw updateError;
  }

  console.log('\nSenha alterada com sucesso.');
  console.log('Ambiente: STAGING');
  console.log('Projeto: shfsjyjxmgwnlexmdkcs');
  console.log(`Usuário: ${targetUser.email}`);
} finally {
  rl.close();
}
