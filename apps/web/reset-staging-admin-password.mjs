import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import readline from 'node:readline';

const ENV_PATH = './.env.local';
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
  throw new Error(
    `ABORTADO: o projeto configurado não é o Staging esperado.\nURL encontrada: ${supabaseUrl}`,
  );
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

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

try {
  console.log('');
  console.log('======================================');
  console.log('RESET DE SENHA - COMPRA CAR STAGING');
  console.log('======================================');
  console.log('');
  console.log('Projeto confirmado: shfsjyjxmgwnlexmdkcs');
  console.log('');

  const email = String(await ask('E-mail do usuário admin: '))
    .trim()
    .toLowerCase();

  if (!email) {
    throw new Error('E-mail não informado.');
  }

  console.log('');
  console.log('Localizando usuário no STAGING...');

  let page = 1;
  let targetUser = null;

  while (!targetUser) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw new Error(`Erro ao consultar usuários: ${error.message}`);
    }

    targetUser = data.users.find((user) => user.email?.trim().toLowerCase() === email);

    if (targetUser) {
      break;
    }

    if (data.users.length < 100) {
      break;
    }

    page += 1;
  }

  if (!targetUser) {
    throw new Error(`Usuário não encontrado no Staging: ${email}`);
  }

  console.log('');
  console.log('Usuário encontrado.');
  console.log(`E-mail: ${targetUser.email}`);
  console.log(`User ID: ${targetUser.id}`);
  console.log('');

  const password = String(await ask('Nova senha: '));

  if (!password) {
    throw new Error('A nova senha não pode estar vazia.');
  }

  if (password.length < 8) {
    throw new Error('Use uma senha com pelo menos 8 caracteres.');
  }

  const confirmation = String(await ask('Digite ALTERAR para confirmar a troca da senha: ')).trim();

  if (confirmation !== 'ALTERAR') {
    throw new Error('Operação cancelada.');
  }

  console.log('');
  console.log('Atualizando senha...');

  const { data, error } = await supabase.auth.admin.updateUserById(targetUser.id, {
    password,
  });

  if (error) {
    throw new Error(`Erro ao atualizar senha: ${error.message}`);
  }

  console.log('');
  console.log('======================================');
  console.log('SENHA ALTERADA COM SUCESSO');
  console.log('======================================');
  console.log('');
  console.log('Ambiente: STAGING');
  console.log('Projeto: shfsjyjxmgwnlexmdkcs');
  console.log(`Usuário: ${data.user.email}`);
  console.log('');
  console.log('Agora teste o login em:');
  console.log('http://localhost:3000/login');
  console.log('');
} catch (error) {
  console.error('');
  console.error('ERRO:');
  console.error(error instanceof Error ? error.message : error);
  console.error('');

  process.exitCode = 1;
} finally {
  rl.close();
}
