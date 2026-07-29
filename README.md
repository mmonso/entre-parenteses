# Entre parênteses

Ensaios de psicologia sobre as relações que nos constituem.

Site estático, sem build. Três arquivos:

- `index.html` — o componente do blog (template + lógica, runtime `dc`)
- `support.js` — runtime que renderiza o componente (carrega React via CDN)
- `posts.json` — conteúdo: site, categorias/tópicos e posts

Fora do site, `publicar.mjs` é a ferramenta que põe um texto no ar (veja abaixo).

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

Ele valida, insere no `posts.json`, commita e dá push — a Vercel publica
sozinha em cerca de um minuto. Flags: `--rascunho` mostra o que faria sem
gravar nada, `--sem-push` para no commit local, `--msg "..."` troca a mensagem
do commit (padrão: `Publica: <título>`).

O script só faz `git add` do `posts.json`, então rascunhos soltos na pasta
nunca entram num commit por acidente.

## Na mão, se precisar

Cada post é um objeto no array `posts` de `posts.json`:

```json
{
  "title": "Título do ensaio",
  "category": "Relação consigo",
  "topic": "Solidão",
  "date": "2026-06-12",
  "body": "Primeiro parágrafo...\n\n## Um subtítulo\n\nOutro parágrafo..."
}
```

Regras do `body`: parágrafos separados por linha em branco, subtítulos com
`## `, e o último parágrafo é renderizado como fecho em itálico. O slug da URL
sai do título automaticamente, e `category`/`topic` precisam bater exatamente
com os valores declarados em `categories`.

Atenção à ordem: nada no site ordena por data. A posição no array `posts` é a
ordem que aparece nas listas, na busca e no "próximo post" — o mais recente vai
em primeiro. O `date` é só exibição. (O `publicar.mjs` cuida disso.)

Commit e push na `main` — a Vercel publica sozinha.
