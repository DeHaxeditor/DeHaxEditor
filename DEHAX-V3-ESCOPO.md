# DeHax Editor — Escopo V3

Este arquivo consolida as decisões da V3 e diferencia o que já entrou no primeiro pacote V3 do que continua reservado para as próximas etapas.

## V3.0.0 — biblioteca e administração

### Hierarquia visual da biblioteca

A biblioteca passa a usar três níveis visuais:

**Categoria → Subcategoria → Pastas**

- Toda pasta continua sendo uma subcategoria real; não existe um novo tipo de conteúdo.
- Uma subcategoria pode ser vinculada como filha de outra subcategoria.
- A mesma filha pode aparecer dentro de mais de uma subcategoria pai.
- O vínculo não duplica o asset nem move arquivos no R2; ele organiza a navegação.
- Subcategorias já existentes podem ser transformadas em filhas pelo Admin.
- Ao abrir a biblioteca, a categoria **SFX** é selecionada por padrão quando existir.
- A antiga aba **Todos** foi removida da navegação por categoria.

Exemplo:

- Categoria: SFX
- Subcategoria: Gameplay Pack
- Pastas: Memes / Interface / Transições

### Exibição por tipo de asset

- **Imagem:** grade de ícones grandes; exibe apenas o preview, sem nome no card.
- **Vídeo:** grade de ícones grandes; mostra thumbnail/primeiro frame, reproduz sem som ao passar o mouse e abre o preview com som ao clicar.
- **Áudio/SFX, músicas, presets, LUTs e demais arquivos:** continuam em lista.

### Administração em massa

O Admin V3 inclui:

- seleção de múltiplos assets;
- alteração em massa de FREE/PRO;
- alteração em massa de categoria e subcategoria;
- alteração em massa de status;
- ativar/pausar download e preview em massa;
- adicionar, substituir ou remover tags em massa;
- exclusão em massa;
- botão para padronizar todos os nomes exibidos no site.

Padrão de nome escolhido: **tudo em minúsculas, mantendo somente a primeira letra maiúscula**. Exemplo: `WHOOSH IMPACT 01` → `Whoosh impact 01`.

### Tags por categoria

- Cada categoria pode ter seu próprio cadastro de tags.
- Tags podem ser criadas, editadas, pausadas e excluídas no Admin.
- As tags dos assets continuam armazenadas no próprio asset e podem ser alteradas em massa.
- Excluir uma tag do cadastro da categoria não apaga silenciosamente a mesma palavra dos assets já publicados.

### SEO orgânico

- canonical nas páginas públicas principais;
- robots de indexação nas páginas públicas;
- app, admin, login e checkout continuam fora da indexação;
- Open Graph e Twitter metadata;
- dados estruturados Schema.org;
- `sitemap.xml`;
- `robots.txt` apontando para o sitemap;
- textos públicos ajustados para termos relevantes à biblioteca: SFX, transições, LUTs, overlays, presets, assets e edição de gameplay.

## Metadados DeHax — requisito preservado para a V3

Regra aprovada para arquivos compatíveis:

- **Artist:** `Dehax`
- **Publisher/Distributor:** `Dehax Editor`
- **Comment:** `Distributed by Dehax Editor`

A V3 deverá ter:

1. aplicação automática nos novos uploads;
2. processamento em lote dos arquivos já publicados;
3. equivalentes compatíveis para imagens e vídeos;
4. status no Admin: `Aplicado`, `Pendente`, `Formato não compatível` e `Erro`;
5. sem definir automaticamente `Copyright © Dehax` para material licenciado de terceiros.

A V3.0.0 já prepara no banco os campos `metadata_status` e `metadata_version`. A modificação binária dos arquivos no R2 será implementada em uma etapa própria, para evitar recompressão/perda de qualidade e respeitar as diferenças entre MP3, MP4/MOV, JPG/PNG/WebP e outros formatos.

## Afiliados — requisito preservado para a V3

Módulo planejado:

- link/código individual de afiliado;
- atribuição de vendas;
- comissão por venda;
- painel do afiliado;
- saldo pendente / aprovado / pago;
- histórico;
- regras de atribuição;
- controles no Admin.

Percentuais, janela de atribuição, regras de pagamento e antifraude ainda precisam ser definidos antes da implementação financeira.

## Infraestrutura mantida

A V3 continua sobre a arquitetura atual: Netlify + Supabase + Cloudflare R2, preservando autenticação, FREE/PRO, downloads privados, tutoriais, IA de áudio, pagamentos, suporte/reembolso e demais recursos já presentes na V2.3.3.
