# Entre parênteses

Ensaios de psicologia sobre as relações que nos constituem.

Site estático, sem build. Três arquivos:

- `index.html` — o componente do blog (template + lógica, runtime `dc`)
- `support.js` — runtime que renderiza o componente (carrega React via CDN)
- `posts.json` — conteúdo: site, categorias/tópicos e posts

## Rodar localmente

O blog faz `fetch("posts.json")`, então precisa de um servidor HTTP — abrir o
arquivo direto pelo `file://` não funciona.

```bash
npx serve .
# ou
python -m http.server 8000
```

## Publicar um post novo

Adicione um objeto ao array `posts` de `posts.json`:

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

Commit e push na `main` — a Vercel publica sozinha.
