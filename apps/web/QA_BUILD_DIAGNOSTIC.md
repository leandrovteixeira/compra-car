# QA build diagnostic

Railway QA web build temporarily runs `pnpm --filter @compra-car/web exec tsc --noEmit` before the existing Turborepo build. This makes TypeScript errors visible independently of Next.js's lint stream. Remove this diagnostic file and restore the Railway build command to `pnpm turbo run build --filter=@compra-car/web...` after the failure is fixed.
