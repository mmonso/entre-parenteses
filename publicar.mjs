// Publica um post: le um .md/.txt, insere em posts.json e sobe pra Vercel.
// Uso: node publicar.mjs caminho/do/texto.md [--rascunho] [--sem-push] [--msg "..."]

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const raiz = dirname(fileURLToPath(import.meta.url));
const arquivoPosts = join(raiz, "posts.json");

// Identico ao slugify de index.html:204 — a URL do post sai daqui.
const ACENTOS = new RegExp("[\\u0300-\\u036f]", "g");
const slugify = (s) => (s || "").toLowerCase().normalize("NFD").replace(ACENTOS, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const erro = (msg, dica) => {
  console.error("\n  x " + msg);
  if (dica) console.error("    " + dica.split("\n").join("\n    "));
  console.error("");
  process.exit(1);
};

// --- argumentos ---------------------------------------------------------
const argv = process.argv.slice(2);
const rascunho = argv.includes("--rascunho") || argv.includes("--dry-run");
const semPush = argv.includes("--sem-push");
const iMsg = argv.indexOf("--msg");
const msgManual = iMsg !== -1 ? argv[iMsg + 1] : null;
const entrada = argv.find((a, i) => !a.startsWith("--") && !(iMsg !== -1 && i === iMsg + 1));

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

// --- valida contra o posts.json ----------------------------------------
const original = readFileSync(arquivoPosts, "utf8");
const dados = JSON.parse(original);

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

const slug = slugify(title);
if (!slug) erro(`O titulo "${title}" nao gera URL valida.`, "Ele precisa ter pelo menos uma letra ou numero.");
const colisao = dados.posts.find((p) => slugify(p.title) === slug);
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
const novo = { title, category, topic, date: data, body: corpo };
let posicao = dados.posts.findIndex((p) => p.date < data);
if (posicao === -1) posicao = dados.posts.length;
dados.posts.splice(posicao, 0, novo);

const saida = JSON.stringify(dados, null, 2) + "\n";
JSON.parse(saida); // garante que o que vamos gravar e JSON valido

// --- relatorio ---------------------------------------------------------
console.log(`\n  ${title}`);
console.log(`  ${category} / ${topic} · ${data}`);
console.log(`  /#/post/${slug}`);
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

const git = (...args) => spawnSync("git", args, { cwd: raiz, encoding: "utf8" });

const branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.trim();
if (branch !== "main") {
  console.log(`\n  ! Voce esta na branch "${branch}", nao na main. Gravei o post, mas nao vou commitar nem publicar.`);
  console.log("    Resolva a branch e rode: git add posts.json && git commit -m \"...\" && git push origin main\n");
  process.exit(0);
}

// Mensagem via arquivo: evita o editor abrir e preserva os acentos.
const arquivoMsg = join(tmpdir(), "publicar-msg.txt");
writeFileSync(arquivoMsg, (msgManual || `Publica: ${title}`) + "\n", "utf8");

git("add", "--", "posts.json");
const commit = git("commit", "-F", arquivoMsg, "--", "posts.json");
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

console.log("\n  no ar: https://entre-parenteses.vercel.app/#/post/" + slug);
console.log("  (a Vercel leva ~1 minuto pra atualizar)\n");
