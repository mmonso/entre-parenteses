// Publica um post: le um .md/.txt, insere em posts.json e sobe pra Vercel.
// Uso: node publicar.mjs caminho/do/texto.md [--rascunho] [--sem-push] [--msg "..."]

import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const raiz = dirname(fileURLToPath(import.meta.url));
const arquivoPosts = join(raiz, "posts.json");
const pastaPaginas = join(raiz, "post");

const git = (...args) => spawnSync("git", args, { cwd: raiz, encoding: "utf8" });

// Identico ao slugify de index.html:204 — a URL do post sai daqui.
const ACENTOS = new RegExp("[\\u0300-\\u036f]", "g");
const slugify = (s) => (s || "").toLowerCase().normalize("NFD").replace(ACENTOS, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const erro = (msg, dica) => {
  console.error("\n  x " + msg);
  if (dica) console.error("    " + dica.split("\n").join("\n    "));
  console.error("");
  process.exit(1);
};

// Mesmo resumo do index.html (resumoDe) — os dois precisam bater, senao o
// preview do link conta uma coisa e a pagina mostra outra.
const resumoDe = (body) => {
  const abertura = (body || "").split(/\n{2,}/).map((s) => s.trim()).filter(Boolean).find((b) => !b.startsWith("## ")) || "";
  if (abertura.length <= 160) return abertura;
  const corte = abertura.slice(0, 158);
  return corte.slice(0, corte.lastIndexOf(" ")).replace(/[\s.,;:—-]+$/, "") + "…";
};

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ICONE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23faf7f1'/%3E%3Ctext x='16' y='23' font-family='Georgia,serif' font-size='20' fill='%23a2603e' text-anchor='middle'%3E()%3C/text%3E%3C/svg%3E";

// O robô do WhatsApp, do Telegram e do Facebook nao roda JS e nunca recebe o
// que vem depois do "#" — por isso /#/post/x jamais gera preview. Estas paginas
// existem so pra isso: carregam as meta tags no HTML cru, trazem o ensaio
// inteiro pro Google indexar, e mandam gente de verdade pro site na hora.
function paginaDoPost(post, site, raizUrl) {
  const url = raizUrl + "/post/" + post.slug;
  const resumo = resumoDe(post.body);
  const corpo = post.body.split(/\n{2,}/).map((t) => t.trim()).filter(Boolean)
    .map((t) => (t.startsWith("## ") ? "  <h2>" + esc(t.slice(3)) + "</h2>" : "  <p>" + esc(t) + "</p>"))
    .join("\n");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(post.title)} — ${esc(site.title)}</title>
<meta name="description" content="${esc(resumo)}">
<link rel="canonical" href="${esc(url)}">
<link rel="icon" href="${ICONE}">
<meta name="theme-color" content="#faf7f1">
<meta property="og:site_name" content="${esc(site.title)}">
<meta property="og:type" content="article">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(post.title)}">
<meta property="og:description" content="${esc(resumo)}">
<meta property="og:url" content="${esc(url)}">
<meta property="article:published_time" content="${esc(post.date)}">
<meta property="article:section" content="${esc(post.category)}">
<meta property="article:tag" content="${esc(post.topic)}">
<meta name="twitter:card" content="summary">
<script>location.replace("/#/post/${post.slug}");</script>
<style>
  body { margin:0; background:#faf7f1; color:#2b2621; font-family:'Lora',Georgia,serif; }
  main { max-width:650px; margin:0 auto; padding:12vh 26px; }
  h1 { font-weight:400; font-size:33px; line-height:1.36; }
  h2 { font-weight:400; font-size:20px; color:#5c5247; margin-top:48px; }
  p { font-size:19px; line-height:1.95; }
  .meta { font-family:Inter,system-ui,sans-serif; font-size:11px; letter-spacing:0.2em; text-transform:uppercase; color:#776d60; }
</style>
</head>
<body>
<main>
  <p class="meta">${esc(post.category)} / ${esc(post.topic)} · ${esc(post.date)}</p>
  <h1>${esc(post.title)}</h1>
${corpo}
  <p class="meta"><a href="/#/post/${post.slug}">Ler em ${esc(site.title)}</a></p>
</main>
</body>
</html>
`;
}

function sitemapDe(posts, raizUrl) {
  const url = (loc, lastmod) => "  <url>\n    <loc>" + esc(loc) + "</loc>\n" + (lastmod ? "    <lastmod>" + esc(lastmod) + "</lastmod>\n" : "") + "  </url>";
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + [url(raizUrl + "/", posts[0] && posts[0].date), ...posts.map((p) => url(raizUrl + "/post/" + p.slug, p.date))].join("\n")
    + "\n</urlset>\n";
}

// Reescreve tudo a cada publicacao: assim um titulo corrigido no posts.json se
// propaga pro preview, e pagina de post apagado nao fica orfa no ar.
function gerarPaginas(dados, raizUrl) {
  mkdirSync(pastaPaginas, { recursive: true });
  const validos = new Set(dados.posts.map((p) => p.slug + ".html"));
  for (const f of readdirSync(pastaPaginas)) {
    if (f.endsWith(".html") && !validos.has(f)) unlinkSync(join(pastaPaginas, f));
  }
  for (const p of dados.posts) {
    writeFileSync(join(pastaPaginas, p.slug + ".html"), paginaDoPost(p, dados.site, raizUrl), "utf8");
  }
  writeFileSync(join(raiz, "sitemap.xml"), sitemapDe(dados.posts, raizUrl), "utf8");
  writeFileSync(join(raiz, "robots.txt"), "User-agent: *\nAllow: /\n\nSitemap: " + raizUrl + "/sitemap.xml\n", "utf8");
  return dados.posts.length;
}

// Traz o que estiver no GitHub antes de gravar. Sem isso, se a main remota
// andasse por fora, o post ficava commitado aqui e o push morria na frente.
function sincronizaComOrigin() {
  const branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.trim();
  if (branch !== "main") return branch;
  if (git("fetch", "origin").status !== 0) {
    console.log("\n  ! Nao consegui falar com o GitHub agora. Sigo com o que esta aqui.");
    return branch;
  }
  const atras = git("rev-list", "--count", "HEAD..origin/main").stdout.trim();
  if (atras === "0" || atras === "") return branch;
  console.log(`\n  origin/main tem ${atras} commit(s) que voce nao tem. Trazendo antes de publicar...`);
  if (git("rebase", "origin/main").status !== 0) {
    git("rebase", "--abort");
    erro("Nao consegui alinhar com o GitHub — a main daqui e a de la divergiram.", "Rode 'git pull --rebase' na mao, resolva o conflito, e publique de novo.");
  }
  return branch;
}

// --- argumentos ---------------------------------------------------------
const argv = process.argv.slice(2);
const rascunho = argv.includes("--rascunho") || argv.includes("--dry-run");
const semPush = argv.includes("--sem-push");
const iMsg = argv.indexOf("--msg");
const msgManual = iMsg !== -1 ? argv[iMsg + 1] : null;
const entrada = argv.find((a, i) => !a.startsWith("--") && !(iMsg !== -1 && i === iMsg + 1));

// Regera as paginas de preview a partir do posts.json, sem publicar nada. Serve
// pra quando um titulo e corrigido na mao ou o modelo da pagina muda.
if (argv.includes("--so-paginas")) {
  const d = JSON.parse(readFileSync(arquivoPosts, "utf8"));
  const url = ((d.site && d.site.url) || "https://entre-parenteses.vercel.app").replace(/\/$/, "");
  for (const p of d.posts) if (!p.slug) p.slug = slugify(p.title);
  console.log(`\n  ${gerarPaginas(d, url)} paginas + sitemap.xml regenerados. Nada foi commitado.\n`);
  process.exit(0);
}

if (!entrada) {
  erro("Faltou dizer qual arquivo publicar.", 'Uso: node publicar.mjs meu-ensaio.md\n     node publicar.mjs meu-ensaio.md --rascunho   (so simula, nao publica)');
}
if (!existsSync(entrada)) erro(`Arquivo nao encontrado: ${entrada}`);
if (extname(entrada).toLowerCase() === ".docx") {
  erro("Nao leio .docx.", "Abra no Word e use Salvar como > Texto sem formatacao (.txt), UTF-8.");
}

// --- le o rascunho -----------------------------------------------------
let texto = readFileSync(entrada, "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");
if (texto.includes("�")) {
  erro("O arquivo nao esta em UTF-8 — os acentos vao sair quebrados.", "Salve novamente escolhendo a codificacao UTF-8.");
}
// Aceita tambem o estilo com --- na primeira linha, tipo front-matter.
texto = texto.replace(/^---[ \t]*\n/, "");

const corte = texto.indexOf("\n---");
if (corte === -1) {
  erro("Nao achei a linha --- que separa o cabecalho do texto.", 'O arquivo deve comecar assim:\n\ntitle: Titulo do ensaio\ncategory: Relacao consigo\ntopic: Solidao\ndate: 2026-07-29        (opcional, padrao = hoje)\n---\nPrimeiro paragrafo...');
}

const cabecalho = {};
for (const linha of texto.slice(0, corte).split("\n")) {
  const m = linha.match(/^\s*([A-Za-z]+)\s*:\s*(.*?)\s*$/);
  if (m) cabecalho[m[1].toLowerCase()] = m[2];
}
const corpo = texto.slice(corte + 4).replace(/^\n+/, "").replace(/\n{3,}/g, "\n\n").trim();

// --- alinha com o GitHub antes de mexer no arquivo ----------------------
// Vem antes da leitura de proposito: se o rebase trouxer um post novo, e esse
// posts.json ja atualizado que vai ser lido e validado logo abaixo.
const branch = rascunho ? git("rev-parse", "--abbrev-ref", "HEAD").stdout.trim() : sincronizaComOrigin();

// --- valida contra o posts.json ----------------------------------------
const original = readFileSync(arquivoPosts, "utf8");
const dados = JSON.parse(original);
const raizUrl = ((dados.site && dados.site.url) || "https://entre-parenteses.vercel.app").replace(/\/$/, "");

const { title, category, topic } = cabecalho;
if (!title) erro("Falta 'title:' no cabecalho.");
if (!category) erro("Falta 'category:' no cabecalho.");
if (!topic) erro("Falta 'topic:' no cabecalho.");
if (!corpo) erro("O texto do post esta vazio (nada depois do ---).");

const cat = dados.categories.find((c) => c.name === category);
if (!cat) {
  erro(`Categoria "${category}" nao existe.`, "As validas sao:\n" + dados.categories.map((c) => "- " + c.name).join("\n"));
}
if (!cat.topics.includes(topic)) {
  erro(`O topico "${topic}" nao existe em "${category}".`, `Topicos de ${category}:\n` + cat.topics.map((t) => "- " + t).join("\n"));
}

const hoje = new Date();
const data = cabecalho.date || [hoje.getFullYear(), String(hoje.getMonth() + 1).padStart(2, "0"), String(hoje.getDate()).padStart(2, "0")].join("-");
if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) erro(`Data invalida: "${data}".`, "Use o formato AAAA-MM-DD, por exemplo 2026-07-29.");

// O slug e calculado uma vez, aqui, e gravado no post. Dali pra frente ele nao
// muda mais — reescrever o titulo de um ensaio publicado nao quebra os links.
const slug = slugify(title);
if (!slug) erro(`O titulo "${title}" nao gera URL valida.`, "Ele precisa ter pelo menos uma letra ou numero.");
const colisao = dados.posts.find((p) => (p.slug || slugify(p.title)) === slug);
if (colisao) {
  erro(`Ja existe um post com essa URL (/${slug}): "${colisao.title}".`, "Dois posts com o mesmo slug quebram a navegacao. Mude o titulo.");
}

// --- avisos de formatacao (regras do parseBody, index.html:313) --------
const blocos = corpo.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
const avisos = [];
if (blocos.length < 3) avisos.push(`O texto tem so ${blocos.length} bloco(s). O site formata o 1o paragrafo como abertura e o ultimo como fecho em italico — com poucos blocos isso fica estranho.`);
if (blocos[blocos.length - 1].startsWith("## ")) avisos.push("O texto termina num subtitulo. O fecho em italico nao vai aparecer.");
if (!blocos[0].startsWith("## ") && blocos[0].split(" ").length < 4) avisos.push("O primeiro paragrafo tem menos de 4 palavras — as 3 primeiras sao destacadas como abertura.");
if (/\\n/.test(corpo)) avisos.push("Achei '\\n' literal no texto. Aqui voce usa linha em branco de verdade; o escape e feito pra voce.");

// --- monta e insere na posicao certa (data decrescente) ----------------
const novo = { title, slug, category, topic, date: data, body: corpo };
let posicao = dados.posts.findIndex((p) => p.date < data);
if (posicao === -1) posicao = dados.posts.length;
dados.posts.splice(posicao, 0, novo);

const saida = JSON.stringify(dados, null, 2) + "\n";
JSON.parse(saida); // garante que o que vamos gravar e JSON valido

// --- relatorio ---------------------------------------------------------
console.log(`\n  ${title}`);
console.log(`  ${category} / ${topic} · ${data}`);
console.log(`  /post/${slug}`);
console.log(`  ${blocos.length} blocos, ${corpo.split(/\s+/).length} palavras`);
console.log(`  posicao ${posicao + 1} de ${dados.posts.length} no site${posicao === 0 ? " (mais recente)" : ""}`);
for (const a of avisos) console.log(`\n  ! ${a}`);

if (rascunho) {
  console.log("\n  --rascunho: nada foi gravado nem publicado.\n");
  process.exit(0);
}

// --- grava, commita, publica -------------------------------------------
writeFileSync(arquivoPosts, saida, "utf8");
try {
  JSON.parse(readFileSync(arquivoPosts, "utf8"));
} catch (e) {
  writeFileSync(arquivoPosts, original, "utf8");
  erro("A gravacao corrompeu o posts.json — desfiz tudo, o arquivo esta como antes.", String(e.message));
}
console.log("\n  posts.json atualizado.");

const quantas = gerarPaginas(dados, raizUrl);
console.log(`  ${quantas} paginas de preview + sitemap.xml gerados.`);

if (branch !== "main") {
  console.log(`\n  ! Voce esta na branch "${branch}", nao na main. Gravei o post, mas nao vou commitar nem publicar.`);
  console.log("    Resolva a branch e rode: git add posts.json post sitemap.xml robots.txt && git commit -m \"...\" && git push origin main\n");
  process.exit(0);
}

// Mensagem via arquivo: evita o editor abrir e preserva os acentos.
const arquivoMsg = join(tmpdir(), "publicar-msg.txt");
writeFileSync(arquivoMsg, (msgManual || `Publica: ${title}`) + "\n", "utf8");

// Continua por pathspec, agora com os gerados junto. Rascunho solto na pasta
// segue de fora — nenhum "git add ." em lugar nenhum.
const alvos = ["posts.json", "post", "sitemap.xml", "robots.txt"];
git("add", "-A", "--", ...alvos);
const commit = git("commit", "-F", arquivoMsg, "--", ...alvos);
unlinkSync(arquivoMsg);
if (commit.status !== 0) {
  erro("O commit falhou.", (commit.stdout || "") + (commit.stderr || ""));
}
const hash = git("rev-parse", "--short", "HEAD").stdout.trim();
console.log(`  commit ${hash}`);

if (semPush) {
  console.log("\n  --sem-push: commit feito, nada foi enviado. Rode 'git push origin main' quando quiser.\n");
  process.exit(0);
}

const push = git("push", "origin", "main");
if (push.status !== 0) {
  erro("O push falhou — o commit esta salvo aqui, so nao subiu.", (push.stdout || "") + (push.stderr || ""));
}

console.log("\n  no ar:      " + raizUrl + "/#/post/" + slug);
console.log("  compartilhe: " + raizUrl + "/post/" + slug + "  (esse gera preview no WhatsApp)");
console.log("  (a Vercel leva ~1 minuto pra atualizar)\n");
