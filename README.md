# Entre parênteses

Ensaios de psicologia sobre as relações que nos constituem.

Site estático, sem build. Três arquivos:

- `index.html` — o componente do blog (template + lógica, runtime `dc`)
- `support.js` — runtime que renderiza o componente (carrega React via CDN)
- `posts.json` — conteúdo: site, categorias/tópicos e posts

Fora do site, `publicar.mjs` é a ferramenta que põe um texto no ar (veja abaixo).
Ele também gera, a cada publicação, `post/<slug>.html`, `sitemap.xml` e
`robots.txt` — arquivos de saída, não se edita nenhum deles na mão.

## As duas URLs de cada post

O site é uma SPA com rota em `#`, e nenhum robô de rede social enxerga o que
vem depois do `#`. Por isso cada ensaio tem dois endereços:

- `/#/post/<slug>` — a página do site, para navegar
- `/post/<slug>` — página estática só com as meta tags e o texto do ensaio;
  gera o preview no WhatsApp, no Telegram e no Instagram, e é o que o Google
  indexa. Quem abre com um navegador é redirecionado pro site na hora.

**Para compartilhar, use `/post/<slug>`** — é a URL que o `publicar.mjs`
imprime no final. As duas levam ao mesmo lugar.

## Rodar localmente

O blog faz `fetch("posts.json")`, então precisa de um servidor HTTP — abrir o
arquivo direto pelo `file://` não funciona.

```bash
npx serve .
# ou
python -m http.server 8000
```

## Publicar um post novo

Escreva o texto num `.md` ou `.txt`, com o cabeçalho antes de uma linha `---`:

```
title: Título do ensaio
category: Relação consigo
topic: Solidão
date: 2026-06-12
---
Primeiro parágrafo, escrito normal.

## Um subtítulo

Outro parágrafo. Pode usar "aspas" à vontade.
```

O `date` é opcional (padrão: hoje). Depois, um comando:

```
publicar caminho/do/texto.md
```

Ele traz o que estiver no GitHub, valida, insere no `posts.json`, regera as
páginas de preview e o sitemap, commita e dá push — a Vercel publica sozinha em
cerca de um minuto. Flags: `--rascunho` mostra o que faria sem gravar nada,
`--sem-push` para no commit local, `--msg "..."` troca a mensagem do commit
(padrão: `Publica: <título>`), `--so-paginas` regera as páginas estáticas a
partir do `posts.json` sem publicar nada.

O `git add` é por pathspec (`posts.json`, `post/`, `sitemap.xml`, `robots.txt`),
então rascunhos soltos na pasta nunca entram num commit por acidente.

## Na mão, se precisar

Cada post é um objeto no array `posts` de `posts.json`:

```json
{
  "title": "Título do ensaio",
  "slug": "titulo-do-ensaio",
  "category": "Relação consigo",
  "topic": "Solidão",
  "date": "2026-06-12",
  "body": "Primeiro parágrafo...\n\n## Um subtítulo\n\nOutro parágrafo..."
}
```

Regras do `body`: parágrafos separados por linha em branco, subtítulos com
`## `, e o último parágrafo é renderizado como fecho em itálico. O `slug` é
gravado uma vez na publicação e **não se mexe nele depois** — é o endereço do
ensaio, e mudá-lo quebra todo link já compartilhado. Justamente por isso o
título pode ser reescrito à vontade. `category`/`topic` precisam bater
exatamente com os valores declarados em `categories`.

Depois de mexer num post na mão, rode `node publicar.mjs --so-paginas` para o
preview e o sitemap acompanharem.

Atenção à ordem: nada no site ordena por data. A posição no array `posts` é a
ordem que aparece nas listas, na busca e no "próximo post" — o mais recente vai
em primeiro. O `date` é só exibição. (O `publicar.mjs` cuida disso.)

Commit e push na `main` — a Vercel publica sozinha.
