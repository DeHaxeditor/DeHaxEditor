# Atualizar para DeHax V3.0.0

## Importante

O pacote V3.0.0 foi preparado a partir da V2.3.3 com o hotfix de JWT. Faça o primeiro teste na branch `teste`.

Como `teste` e produção usam atualmente os mesmos recursos de Supabase/R2, a migration foi deixada como arquivo e **não foi aplicada automaticamente**.

## 1. Banco de dados

No Supabase SQL Editor, execute:

`supabase/migration-v3.0.0.sql`

A migration é aditiva e cria:

- `asset_subcategory_links` — relações pai/filho entre subcategorias;
- `asset_category_tags` — tags administráveis por categoria;
- `assets.metadata_status` e `assets.metadata_version` — preparação para a etapa de metadados DeHax.

Ela não move nem apaga os assets existentes.

## 2. Publicar na branch de teste

Substitua o projeto da branch `teste` pelos arquivos do pacote V3.0.0 e faça o deploy normalmente.

## 3. Testes principais

1. Abra **Admin → Categorias**.
2. Em uma subcategoria, clique no botão de pastas `▰`.
3. Vincule uma ou mais subcategorias existentes como filhas.
4. Vincule a mesma filha em outro pai e confirme que ela aparece nos dois.
5. Abra a Área de Membros → Biblioteca.
6. Confirme a sequência **Categoria → Subcategoria → Pastas**.
7. Confirme que a categoria inicial é **SFX** e que não existe a aba **Todos**.
8. Teste imagem e vídeo em grade grande; vídeo deve tocar sem som no hover e abrir o preview ao clicar.
9. No Admin → Assets, marque vários itens e teste edição em massa.
10. Teste **Aa PADRONIZAR NOMES** em ambiente de teste antes de usar na base definitiva.

## 4. SEO

Foram adicionados/atualizados:

- `sitemap.xml`;
- `robots.txt`;
- canonical, descrição, Open Graph, Twitter e Schema.org nas páginas públicas principais.

A Área de Membros e o Admin continuam com `noindex`/bloqueados para rastreamento.

## 5. Próximas etapas V3 preservadas

Consulte `DEHAX-V3-ESCOPO.md` para os requisitos de metadados nos arquivos e módulo de afiliados.
