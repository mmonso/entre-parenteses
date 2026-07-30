# Entre parênteses — como trabalhar neste repositório

Blog de ensaios de psicologia. Site estático, sem build: `index.html` (componente
+ lógica), `support.js` (runtime, React via CDN) e `posts.json` (todo o conteúdo).
Hospedado na Vercel, com deploy automático a cada push na `main` — leva cerca de
um minuto. Não existe painel de administração nem upload; publicar é commitar.

`post/*.html`, `sitemap.xml` e `robots.txt` são **saída do `publicar.mjs`**, não
fonte. Nunca edite nenhum deles à mão: a próxima publicação sobrescreve tudo.
Mexeu no `posts.json` direto? Rode `node publicar.mjs --so-paginas` pra regerar.

## Como publicar um post

O Marcelo manda o texto pronto — colado no chat ou salvo como `.md` na pasta do
projeto — e pede pra publicar. Ele não edita o `posts.json` nem roda git.

Não edite o `posts.json` na mão. Use o script:

```
node publicar.mjs caminho/do/texto.md
```

O arquivo de entrada tem cabeçalho e corpo separados por uma linha `---`:

```
title: Título do ensaio
category: Relação consigo
topic: Solidão
date: 2026-07-30        (opcional, padrão: hoje)
---
Primeiro parágrafo, texto normal, com linha em branco entre parágrafos.
```

Se o texto vier colado no chat, salve num `.md` primeiro (`rascunhos/` é
gitignorado) e passe pro script. Ele é que garante as regras abaixo — editar o
JSON direto é onde as coisas quebram.

Flags: `--rascunho` simula sem gravar, `--sem-push` para no commit local,
`--msg "..."` troca a mensagem (padrão: `Publica: <título>`), `--so-paginas`
regera as páginas estáticas e o sitemap sem publicar nada.

Antes de gravar, o script faz `fetch` e rebase em cima da `origin/main`. Se a
main daqui divergir da de lá, ele para e pede resolução manual — nesse caso o
post ainda não foi gravado, então é só resolver e rodar de novo.

**Sempre pergunte a categoria e o tópico se não vierem com o texto.** É a única
informação que o script não consegue adivinhar.

## Regras do conteúdo que quebram o site se ignoradas

- **`category` e `topic` precisam bater exatamente** com os valores declarados em
  `categories` no `posts.json`. Divergiu uma letra ou um acento, o post existe no
  arquivo e não aparece em lugar nenhum. Tópico novo tem que ser cadastrado no
  array `categories` antes de publicar um post nele.
- **Nada no site ordena por data.** Não há nenhum `.sort()` em `index.html` nem em
  `support.js`. A posição no array `posts` é a ordem exibida nas listas de tópico,
  na busca e na sugestão de "próximo post". O mais recente vai em primeiro; o
  campo `date` é apenas exibição. O script insere na posição certa sozinho.
- **O slug fica gravado no post**, calculado a partir do título uma única vez, na
  publicação. Depois disso ele é a URL do ensaio e não se mexe mais nele — o
  título pode ser reescrito sem quebrar link nenhum. Dois posts com o mesmo slug
  quebram a navegação; o script recusa duplicata.
- **Cada post tem duas URLs.** `/#/post/<slug>` é a página do site;
  `/post/<slug>` é uma página estática gerada pelo script, com as meta tags e o
  texto do ensaio, que existe porque robô de rede social não enxerga nada depois
  do `#`. É ela que gera o preview no WhatsApp e é ela que o Google indexa.
  Quando o Marcelo pedir "o link do post", entregue a segunda.
- **Formato do `body`** (`parseBody`, `index.html:313`): blocos separados por linha
  em branco; subtítulo começa com `## `; o primeiro bloco é a abertura (as 3
  primeiras palavras são destacadas) e o último é o fecho, renderizado em itálico.
  Terminar o texto num subtítulo elimina o fecho.
- No JSON, o `body` é uma string só, com `\n\n` escapado entre os parágrafos. O
  script faz esse escape; não escreva `\n` literal no texto de origem.
- `slugify` e `resumoDe` existem em duas cópias, no `index.html` e no
  `publicar.mjs`, cada uma com um comentário apontando pra outra. Mexeu numa,
  mexa na outra: divergindo, o preview do link passa a contar uma coisa e a
  página a mostrar outra.

## Ambiente e git

- O script faz `git add` por pathspec (`posts.json`, `post/`, `sitemap.xml`,
  `robots.txt`) e commita com os mesmos caminhos, então rascunhos soltos na
  pasta nunca entram num commit por acidente. Não existe `git add .` aqui.
- `core.autocrlf=true` nesta máquina; `.gitattributes` fixa `posts.json` em LF.
- `core.editor` global é `code --wait`. Ainda assim, prefira `git commit -m` ou
  `-F arquivo`: sem isso o commit fica esperando um editor abrir.
- Mensagens de commit com acento: passe por `-F` com arquivo UTF-8, ou use o Bash.
  O PowerShell 5.1 corrompe acentos em argumentos para executáveis nativos.
- **Nunca apague arquivos `.lock` do `.git` sem antes confirmar que não há processo
  git rodando** (`Get-Process git`). Com o git ativo, remover a trava corrompe o
  repositório. `objects/maintenance.lock` é da manutenção em segundo plano e não
  bloqueia commit nem push.

## Conferir se subiu

```
node -e 'fetch("https://entre-parenteses.vercel.app/posts.json").then(r=>r.json()).then(d=>console.log(d.posts[0].date, d.posts[0].title))'
```

A conexão MCP da Vercel não tem permissão de listar deployments neste projeto
(403) — verifique pelo conteúdo publicado, como acima.
