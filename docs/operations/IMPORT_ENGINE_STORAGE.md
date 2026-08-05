# Operação do Storage do Import Engine

## Contrato

- Projeto autorizado nesta sprint: Compra Car Staging (`shfsjyjxmgwnlexmdkcs`).
- Bucket: `import-engine-documents`.
- Visibilidade: privada.
- MIME: `application/pdf`.
- Limite por objeto: 32 MiB.
- Limite de aplicação: 20 documentos por dossiê.
- Acesso: backend admin com `service_role`; nunca pelo browser.
- Leitura: signed URL com TTL de 300 segundos, gerada após `requireRole('admin')`.

O path é `commercial_letters/{operation-uuid}/{document-uuid}/{safe-file-name}`. UUIDs evitam
colisão; o nome é sanitizado, não contém caminho do cliente e nenhum segredo é incluído.

## Upload

1. Autorizar o admin e gerar correlation ID.
2. Validar quantidade, extensão, MIME, tamanho e assinatura `%PDF-`.
3. Calcular SHA-256 dos bytes reais e consultar duplicidade.
4. Fazer upload server-side com `upsert = false`.
5. Chamar a RPC atômica, que confirma a existência de cada objeto e persiste batch/documentos/audit.
6. Em falha antes do COMMIT, remover os paths já enviados. Em resposta perdida após COMMIT, repetir a
   mesma operação idempotente e preservar os objetos confirmados.

Não registrar bytes, signed URLs, tokens ou service key. Nome original é metadata; somente o path
sanitizado é usado no Storage.

## Verificações operacionais

Após deploy ou incidente, confirmar:

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'import-engine-documents';

select count(*) as orphan_objects
from storage.objects o
where o.bucket_id = 'import-engine-documents'
  and not exists (
    select 1 from public.pricing_import_documents d
    where d.storage_bucket = o.bucket_id and d.storage_object_path = o.name
  );

select count(*) as missing_objects
from public.pricing_import_documents d
where not exists (
  select 1 from storage.objects o
  where o.bucket_id = d.storage_bucket and o.name = d.storage_object_path
);
```

O resultado esperado dos dois últimos checks é zero. Um órfão deve ser correlacionado com logs da
Server Action e removido somente após confirmar que não corresponde a COMMIT recuperável. Documento
persistido sem objeto é incidente de integridade e não deve ser apagado para esconder a falha.

## Rejeição, arquivo e retenção

Rejeitar documento ou arquivar batch não remove o objeto: o status lógico e a auditoria são
preservados. DELETE físico na tabela é bloqueado. A retenção definitiva, expurgo legal e eventual
job de reconciliação serão decididos antes de automação em produção.

## Segurança e recuperação

- não criar policy pública em `storage.objects` para este bucket;
- não persistir signed URL; gerar uma nova após autorização;
- não usar `getPublicUrl`;
- revogar imediatamente qualquer credencial administrativa exposta;
- em falha inesperada, reportar o correlation ID, nunca a exceção bruta ao operador;
- validar órfãos e ausências depois de retries, deploys ou indisponibilidade do banco.