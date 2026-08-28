export function PwaInstallInstructions({
  id,
  ios,
}: {
  readonly id?: string;
  readonly ios: boolean;
}) {
  return (
    <div
      className="rounded-md border border-border bg-surface-muted p-3 text-sm text-text-secondary"
      id={id}
    >
      {ios ? (
        <ol className="list-decimal space-y-1 pl-5">
          <li>Toque em Compartilhar.</li>
          <li>Escolha “Adicionar à Tela de Início”.</li>
          <li>Toque em “Adicionar”.</li>
        </ol>
      ) : (
        <p>
          Abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.
        </p>
      )}
    </div>
  );
}
