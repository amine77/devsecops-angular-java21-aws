-- =============================================================================
-- V17__add_optimiser_application_java_article.sql — Publie l'article
-- "Optimiser une application Java"
-- =============================================================================
-- Article "HTML designé" : le contenu est un document HTML autonome (avec ses
-- propres balises de style et polices Google Fonts), rendu côté frontend dans
-- un Shadow DOM par RichHtmlArticleComponent — d'où content_type = 'HTML'.
--
-- Le corps de l'article est délimité par un dollar-quoting pour éviter d'avoir
-- à doubler les centaines d'apostrophes du HTML (le délimiteur lui-même n'est
-- volontairement cité nulle part ailleurs dans ce fichier, y compris en
-- commentaire, pour ne pas risquer de perturber le parseur de Flyway).
--
-- Comme pour V16, aucune neutralisation de placeholder n'est nécessaire :
-- l'article ne contient aucune séquence dollar-accolade, qui est le préfixe des
-- placeholders de Flyway et que celui-ci substitue y compris À L'INTÉRIEUR d'un
-- dollar-quoting. Le seul dollar du HTML est une ancre de fin de regex nginx,
-- séparée de l'accolade ouvrante par une espace, donc sans effet. Vérifié par
-- recherche sur le fichier, puis les 17 migrations ont été rejouées avec le
-- vrai moteur Flyway 11 — et non avec psql, qui n'a aucune notion de
-- placeholder et avait laissé passer le bug de V15.
--
-- L'image de couverture est servie en statique par le frontend
-- (frontend/src/assets/images/articles/), son URL est absolue car elle sert
-- aussi de og:image (les crawlers sociaux n'acceptent pas les chemins relatifs).
-- Elle n'apparaît que dans la vignette de la liste : la page article ne
-- l'affiche pas.
-- =============================================================================

INSERT INTO articles (title, slug, summary, content, content_type, cover_image_url, status, published_at, user_id, created_at, updated_at)
SELECT
    'Optimiser une application Java : le problème n''est presque jamais là où on le cherche',
    'optimiser-application-java',
    'On passe deux jours à optimiser une boucle qui coûte 4 ms, pendant qu''une requête SQL sans index en coûte 900. La chaîne complète, couche par couche, et l''ordre dans lequel la parcourir.',
    $article$
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Optimiser une application Java : le problème n'est presque jamais là où on le cherche</title>
<meta name="description" content="Optimiser une application Java sur toute la chaîne : SQL, Hibernate, cache, compression HTTP et bundle Angular. Où passe réellement le temps, comment le mesurer, et dans quel ordre agir.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{
  --ink:#0D1524;--ink-soft:#17223A;--ink-line:#2A3A5C;
  --paper:#FFFFFF;--wash:#EEF2F8;--rule:#D5DEEC;--text:#161E2E;--muted:#5A6883;

  /* Langage visuel : les couches de la chaîne */
  --db:#E23D4E;        /* base de données */
  --db-soft:#FCE8EA;
  --back:#EFA02B;      /* backend / JVM */
  --back-soft:#FDF1DD;
  --net:#3566E8;       /* réseau / HTTP */
  --net-soft:#E7EDFD;
  --front:#16A75C;     /* navigateur */
  --front-soft:#E4F6EC;

  --volt:#3566E8;--volt-soft:#E7EDFD;
  --display:"Space Grotesk",system-ui,sans-serif;
  --body:"Source Serif 4",Georgia,serif;
  --mono:"JetBrains Mono",ui-monospace,Menlo,monospace;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--text);font-family:var(--body);font-size:19px;line-height:1.68;-webkit-font-smoothing:antialiased}
.wrap{max-width:760px;margin:0 auto;padding:0 24px}

.hero{background:var(--ink);color:#fff;padding:72px 0 64px;position:relative;overflow:hidden}
.hero::after{content:"";position:absolute;inset:0;background-image:linear-gradient(var(--ink-line) 1px,transparent 1px),linear-gradient(90deg,var(--ink-line) 1px,transparent 1px);background-size:44px 44px;opacity:.35;mask-image:radial-gradient(ellipse 70% 80% at 70% 20%,#000,transparent 75%);-webkit-mask-image:radial-gradient(ellipse 70% 80% at 70% 20%,#000,transparent 75%);pointer-events:none}
.hero .wrap{position:relative;z-index:1}
.eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#7E93BC;margin:0 0 20px}
.hero h1{font-family:var(--display);font-weight:700;font-size:clamp(32px,5.6vw,52px);line-height:1.08;letter-spacing:-.02em;margin:0 0 20px}
.hero h1 em{font-style:normal;color:var(--back)}
.standfirst{font-size:20px;color:#BECBE2;margin:0 0 32px;max-width:58ch}
.byline{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;font-family:var(--mono);font-size:12.5px;color:#8FA3C8;border-top:1px solid var(--ink-line);padding-top:18px}
.byline b{color:#fff;font-weight:500}

.states-strip{background:var(--ink-soft);border-top:1px solid var(--ink-line)}
.states-strip .wrap{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;padding:0}
.state-chip{padding:18px 20px;background:var(--ink-soft)}
.state-chip .dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:8px}
.state-chip .nm{font-family:var(--mono);font-size:12.5px;font-weight:700;color:#fff;letter-spacing:.04em}
.state-chip .ds{font-family:var(--body);font-size:13.5px;color:#93A6C9;margin-top:4px;line-height:1.4}

main{padding:56px 0 0}
h2{font-family:var(--display);font-weight:700;font-size:clamp(25px,3.6vw,33px);line-height:1.18;letter-spacing:-.015em;margin:64px 0 8px;padding-top:26px;border-top:2px solid var(--text)}
h2 .num{display:block;font-family:var(--mono);font-size:12px;font-weight:500;letter-spacing:.16em;color:var(--volt);margin-bottom:10px}
h3{font-family:var(--display);font-weight:600;font-size:20px;letter-spacing:-.01em;margin:38px 0 6px}
p{margin:0 0 20px}
a{color:var(--volt);text-underline-offset:3px}
strong{font-weight:600}
code{font-family:var(--mono);font-size:.84em;background:var(--wash);border:1px solid var(--rule);border-radius:4px;padding:1px 5px;overflow-wrap:anywhere}
ul,ol{margin:0 0 20px;padding-left:22px}
li{margin-bottom:9px}
li::marker{color:var(--volt)}

figure{margin:34px 0}
figure svg{display:block;width:100%;height:auto;border-radius:10px}
figcaption{font-family:var(--mono);font-size:12.5px;color:var(--muted);margin-top:10px;line-height:1.5}
figcaption b{color:var(--text);font-weight:700}

.code{background:var(--ink);border-radius:10px;margin:26px 0;overflow:hidden}
.code-head{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid var(--ink-line);font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:#8FA3C8}
.code-head span:last-child{color:#5B6E93;text-transform:none;letter-spacing:0}
.code pre{margin:0;padding:18px 16px;overflow-x:auto;font-family:var(--mono);font-size:13.5px;line-height:1.62;color:#DCE5F5}
.k{color:#7FA9FF}.s{color:#8DE0A6}.c{color:#6B7FA3;font-style:italic}.a{color:#F2C46B}.t{color:#6FD2E2}.r{color:#F3A8B0}

.note{border-left:4px solid var(--volt);background:var(--volt-soft);padding:16px 20px;border-radius:0 8px 8px 0;margin:26px 0;font-size:17.5px}
.note .lbl{font-family:var(--mono);font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--volt);display:block;margin-bottom:6px;font-weight:700}
.note p:last-child{margin-bottom:0}
.note.warn{border-color:var(--db);background:var(--db-soft)}
.note.warn .lbl{color:var(--db)}
.note.good{border-color:var(--front);background:var(--front-soft)}
.note.good .lbl{color:var(--front)}

.table-scroll{overflow-x:auto;margin:26px 0;border:1px solid var(--rule);border-radius:10px}
table{border-collapse:collapse;width:100%;font-size:15.5px;min-width:600px}
th{background:var(--wash);font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;text-align:left;padding:12px 16px;color:var(--muted);font-weight:700;border-bottom:1px solid var(--rule)}
td{padding:13px 16px;border-bottom:1px solid var(--rule);vertical-align:top;line-height:1.5}
tr:last-child td{border-bottom:0}
td:first-child{width:34%}

.pitfall{display:grid;grid-template-columns:44px 1fr;gap:16px;padding:20px 0;border-bottom:1px solid var(--rule)}
.pitfall:last-of-type{border-bottom:0}
.pitfall .no{font-family:var(--mono);font-size:15px;font-weight:700;color:var(--db);background:var(--db-soft);border-radius:8px;height:36px;display:grid;place-items:center}
.pitfall h4{font-family:var(--display);font-size:18px;font-weight:600;margin:4px 0 6px}
.pitfall p{margin:0;font-size:17px}

.cheat{background:var(--ink);border-radius:14px;padding:32px;margin:44px 0;color:#fff}
.cheat h3{color:#fff;margin:0 0 4px;font-size:24px}
.cheat .sub{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#7E93BC;margin:0 0 26px}
.cheat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
.cheat-card{background:var(--ink-soft);border-radius:10px;padding:16px 18px;border-top:3px solid var(--volt)}
.cheat-card.c-db{border-color:var(--db)}
.cheat-card.c-back{border-color:var(--back)}
.cheat-card.c-net{border-color:var(--net)}
.cheat-card.c-front{border-color:var(--front)}
.cheat-card .h{font-family:var(--mono);font-size:12.5px;font-weight:700;letter-spacing:.06em;margin-bottom:8px}
.c-db .h{color:var(--db)}
.c-back .h{color:var(--back)}
.c-net .h{color:#8FB2FF}
.c-front .h{color:var(--front)}
.cheat-card ul{margin:0;padding-left:16px;font-size:14.5px;line-height:1.5;color:#C3D0E6}
.cheat-card li{margin-bottom:5px}
.cheat-card li::marker{color:#5B6E93}
.cheat-card code{background:#0D1524;border-color:#2A3A5C;color:#F2C46B;font-size:12px;overflow-wrap:anywhere;word-break:break-word;max-width:100%;display:inline-block}

.bio{border-top:2px solid var(--text);margin-top:64px;padding:26px 0 72px;display:grid;gap:6px}
.bio .who{font-family:var(--display);font-weight:600;font-size:19px}
.bio p{font-size:17px;color:var(--muted);margin:0}

@media (max-width:760px){.states-strip .wrap{grid-template-columns:repeat(2,1fr)}}
@media (max-width:640px){
  body{font-size:18px}
  .states-strip .wrap{grid-template-columns:1fr}
  .state-chip{border-bottom:1px solid var(--ink-line)}
  .cheat{padding:24px 20px;border-radius:0;margin-left:-24px;margin-right:-24px}
  .pitfall{grid-template-columns:36px 1fr;gap:12px}
}
</style>
</head>
<body>

<header class="hero">
  <div class="wrap">
    <p class="eyebrow">Performance · Java 21 · Spring Boot · PostgreSQL · Angular</p>
    <h1>Optimiser une application Java : le problème n'est presque <em>jamais</em> là où on le cherche</h1>
    <p class="standfirst">On passe deux jours à optimiser une boucle qui coûte 4 ms, pendant qu'une requête SQL sans index en coûte 900. Voici la chaîne complète, couche par couche, et l'ordre dans lequel il faut la parcourir.</p>
    <div class="byline">
      <span>Par <b>Amine Charrad</b></span>
      <span>·</span>
      <span>18 min de lecture</span>
      <span>·</span>
      <span>Spring Boot 3 · Hibernate · Angular</span>
    </div>
  </div>
</header>

<div class="states-strip">
  <div class="wrap">
    <div class="state-chip">
      <div class="nm"><span class="dot" style="background:#E23D4E"></span>BASE</div>
      <div class="ds">Index, N+1, volumétrie. Là où se cachent les gros gains.</div>
    </div>
    <div class="state-chip">
      <div class="nm"><span class="dot" style="background:#EFA02B"></span>BACKEND</div>
      <div class="ds">Mapping, sérialisation, cache, pool de connexions.</div>
    </div>
    <div class="state-chip">
      <div class="nm"><span class="dot" style="background:#3566E8"></span>RÉSEAU</div>
      <div class="ds">Taille de la réponse, compression, en-têtes de cache.</div>
    </div>
    <div class="state-chip">
      <div class="nm"><span class="dot" style="background:#16A75C"></span>NAVIGATEUR</div>
      <div class="ds">Bundle, rendu, images. Souvent la moitié du temps perçu.</div>
    </div>
  </div>
</div>

<main>
<div class="wrap">

<p>« L'application est lente. » La phrase arrive en réunion, sans plus de précision, et la réaction la plus fréquente consiste à ouvrir le code métier pour y chercher une boucle mal écrite.</p>

<p>Dans la grande majorité des cas, ce n'est pas là. Le temps se répartit sur une chaîne qui va du disque de la base jusqu'au rendu dans le navigateur, et l'expérience montre que le goulot se trouve presque toujours à un endroit qu'on n'avait pas regardé.</p>

<h2><span class="num">01 — Avant tout</span>Mesurer, sinon vous optimisez au hasard</h2>

<p>Une seule règle avant de toucher quoi que ce soit : obtenir la décomposition du temps. Sans elle, vous n'optimisez pas, vous pariez.</p>

<figure>
<svg viewBox="0 0 760 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Décomposition du temps d'une requête sur les quatre couches de la chaîne">
  <rect width="760" height="320" fill="#0D1524"/>
  <g stroke="#2A3A5C" stroke-width="1" opacity=".3">
    <path d="M0 40H760M0 80H760M0 120H760M0 160H760M0 200H760M0 240H760M0 280H760"/>
    <path d="M60 0V320M160 0V320M260 0V320M360 0V320M460 0V320M560 0V320M660 0V320"/>
  </g>

  <text x="24" y="38" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#FFFFFF">OÙ PASSE LE TEMPS — page « liste des contrats »</text>
  <text x="24" y="56" font-family="JetBrains Mono, monospace" font-size="11" fill="#7E93BC">total perçu : 2 400 ms</text>

  <!-- barres -->
  <text x="24" y="90" font-family="JetBrains Mono, monospace" font-size="11" fill="#F3A8B0">SQL</text>
  <rect x="120" y="76" width="430" height="22" rx="4" fill="#E23D4E"/>
  <text x="562" y="92" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" fill="#F3A8B0">1 180 ms</text>
  <text x="640" y="92" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#7E93BC">49 %</text>

  <text x="24" y="128" font-family="JetBrains Mono, monospace" font-size="11" fill="#F6C784">Backend</text>
  <rect x="120" y="114" width="120" height="22" rx="4" fill="#EFA02B"/>
  <text x="562" y="130" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" fill="#F6C784">330 ms</text>
  <text x="640" y="130" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#7E93BC">14 %</text>

  <text x="24" y="166" font-family="JetBrains Mono, monospace" font-size="11" fill="#8FB2FF">Transfert</text>
  <rect x="120" y="152" width="106" height="22" rx="4" fill="#3566E8"/>
  <text x="562" y="168" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" fill="#8FB2FF">290 ms</text>
  <text x="640" y="168" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#7E93BC">12 %</text>

  <text x="24" y="204" font-family="JetBrains Mono, monospace" font-size="11" fill="#8FE0B0">Navigateur</text>
  <rect x="120" y="190" width="220" height="22" rx="4" fill="#16A75C"/>
  <text x="562" y="206" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" fill="#8FE0B0">600 ms</text>
  <text x="640" y="206" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#7E93BC">25 %</text>

  <!-- ce qu'on optimise par reflexe -->
  <rect x="24" y="234" width="712" height="30" rx="6" fill="#1E1420" stroke="#E23D4E" stroke-width="1.5" stroke-dasharray="6 4"/>
  <text x="380" y="254" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#F3A8B0">Le réflexe : ouvrir le code métier. Il pèse ici 40 ms sur 2 400.</text>

  <rect x="24" y="276" width="712" height="30" rx="8" fill="#17223A" stroke="#2A3A5C"/>
  <text x="380" y="296" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#C3D0E6">Divisez le SQL par trois : vous gagnez 780 ms. Le reste peut attendre.</text>
</svg>
<figcaption><b>Fig. 1</b> — Répartition typique sur une page de liste mal optimisée. Tant que vous n'avez pas ce graphique pour <em>votre</em> application, toute optimisation est une intuition.</figcaption>
</figure>

<h3>Les outils, un par couche</h3>

<div class="table-scroll">
<table>
  <thead><tr><th>Couche</th><th>Comment mesurer</th></tr></thead>
  <tbody>
    <tr><td><strong>SQL</strong></td><td><code>EXPLAIN (ANALYZE, BUFFERS)</code> sur les requêtes lentes, et <code>pg_stat_statements</code> pour savoir lesquelles le sont réellement en production.</td></tr>
    <tr><td><strong>Backend</strong></td><td>Micrometer + Actuator pour les temps par endpoint, et un enregistrement JFR sous charge pour le détail.</td></tr>
    <tr><td><strong>Réseau</strong></td><td>Onglet Réseau du navigateur : taille transférée, taille décompressée, en-têtes de cache.</td></tr>
    <tr><td><strong>Navigateur</strong></td><td>Lighthouse et le panneau Performance. Les métriques qui comptent sont LCP, INP et CLS.</td></tr>
  </tbody>
</table>
</div>

<div class="note warn">
  <span class="lbl">Regardez les percentiles, pas la moyenne</span>
  <p>Une moyenne à 180 ms peut cacher un P99 à 4 secondes — c'est-à-dire un utilisateur sur cent qui attend quatre secondes, et ce sont souvent vos plus gros comptes, ceux qui ont le plus de données. Suivez P50, P95 et P99. La moyenne ne décrit l'expérience de personne.</p>
</div>

<h2><span class="num">02 — Couche base</span>C'est là que se trouvent les gros gains</h2>

<p>Dans les applications de gestion, la base représente presque toujours la part dominante du temps. Trois causes suffisent à expliquer l'essentiel.</p>

<h3>Le N+1, toujours lui</h3>

<p>Vous chargez cent contrats, puis pour chacun le code accède au client. Hibernate déclenche une requête par contrat : cent-une requêtes au lieu d'une. Chacune est rapide — deux millisecondes — mais l'aller-retour réseau les multiplie.</p>

<div class="code">
  <div class="code-head"><span>Détection puis correction</span><span>Java 21</span></div>
<pre><span class="c">// ✕ Déclenche N+1 : une requête par contrat pour charger le client</span>
<span class="a">@Query</span>(<span class="s">"select c from Contrat c where c.actif = true"</span>)
<span class="t">List</span>&lt;<span class="t">Contrat</span>&gt; contratsActifs();

<span class="c">// ✓ Une seule requête, avec la jointure explicite</span>
<span class="a">@Query</span>(<span class="s">"""
    select distinct c from Contrat c
    join fetch c.client
    join fetch c.garanties
    where c.actif = true
    """</span>)
<span class="t">List</span>&lt;<span class="t">Contrat</span>&gt; contratsActifs();

<span class="c">// ✓ Alternative déclarative, plus lisible sur des graphes profonds</span>
<span class="a">@EntityGraph</span>(attributePaths = {<span class="s">"client"</span>, <span class="s">"garanties"</span>})
<span class="t">List</span>&lt;<span class="t">Contrat</span>&gt; findByActifTrue();</pre>
</div>

<p>Pour le détecter systématiquement plutôt qu'au hasard, activez le comptage de requêtes en développement :</p>

<div class="code">
  <div class="code-head"><span>application-dev.yml</span><span>YAML</span></div>
<pre><span class="a">spring</span>:
  <span class="a">jpa</span>:
    <span class="a">properties</span>:
      <span class="a">hibernate</span>:
        <span class="a">generate_statistics</span>: <span class="s">true</span>
        <span class="c"># Charge les associations par lots de 50 au lieu d'une par une</span>
        <span class="a">default_batch_fetch_size</span>: <span class="s">50</span>
    <span class="c"># À passer à false : évite les requêtes déclenchées pendant la sérialisation</span>
    <span class="a">open-in-view</span>: <span class="s">false</span>

<span class="a">logging</span>:
  <span class="a">level</span>:
    <span class="a">org.hibernate.stat</span>: DEBUG</pre>
</div>

<p>Un mot sur <code>open-in-view</code> : activé par défaut dans Spring Boot, il maintient la session Hibernate ouverte pendant le rendu de la réponse. Confortable, mais il transforme chaque accès à une association paresseuse en requête déclenchée hors de la couche service — donc invisible dans vos traces et impossible à optimiser au bon endroit. Le passer à <code>false</code> révèle immédiatement tous les chargements implicites, sous forme d'exceptions. C'est désagréable une journée, et sain ensuite.</p>

<h3>Les index manquants</h3>

<p>Un index absent ne se voit pas en développement, sur mille lignes. Il se voit en production, sur deux millions, et le facteur est de l'ordre de mille.</p>

<div class="code">
  <div class="code-head"><span>Diagnostic PostgreSQL</span><span>SQL</span></div>
<pre><span class="c">-- Les requêtes qui coûtent réellement, cumulées sur la période</span>
<span class="k">SELECT</span> calls, mean_exec_time, total_exec_time, query
<span class="k">FROM</span> pg_stat_statements
<span class="k">ORDER BY</span> total_exec_time <span class="k">DESC</span>
<span class="k">LIMIT</span> 20;

<span class="c">-- Le plan réel d'une requête suspecte</span>
<span class="k">EXPLAIN</span> (<span class="k">ANALYZE</span>, BUFFERS)
<span class="k">SELECT</span> * <span class="k">FROM</span> contrat
<span class="k">WHERE</span> client_id = 4211 <span class="k">AND</span> statut = <span class="s">'ACTIF'</span>
<span class="k">ORDER BY</span> date_effet <span class="k">DESC</span> <span class="k">LIMIT</span> 20;</pre>
</div>

<p>Dans le plan, cherchez <code>Seq Scan</code> sur une grosse table : c'est un parcours complet. Et comparez <code>rows</code> estimé et <code>actual rows</code> — un écart d'un facteur dix signale des statistiques périmées, donc un plan choisi sur de mauvaises bases.</p>

<div class="code">
  <div class="code-head"><span>Index composite</span><span>SQL</span></div>
<pre><span class="c">-- L'ordre des colonnes n'est pas indifférent :</span>
<span class="c">-- d'abord l'égalité, ensuite le tri</span>
<span class="k">CREATE INDEX</span> idx_contrat_client_statut_date
    <span class="k">ON</span> contrat (client_id, statut, date_effet <span class="k">DESC</span>);

<span class="c">-- Index partiel : plus petit, donc plus efficace,</span>
<span class="c">-- quand la majorité des lignes ne vous intéresse jamais</span>
<span class="k">CREATE INDEX</span> idx_contrat_actifs
    <span class="k">ON</span> contrat (client_id, date_effet <span class="k">DESC</span>)
    <span class="k">WHERE</span> statut = <span class="s">'ACTIF'</span>;</pre>
</div>

<div class="note">
  <span class="lbl">Un index n'est pas gratuit</span>
  <p>Chaque index ralentit les écritures et occupe de l'espace. Sur une table à fort taux d'insertion, dix index se paient. Vérifiez lesquels servent vraiment avec <code>pg_stat_user_indexes</code> : un index dont <code>idx_scan</code> reste à zéro depuis trois mois est un coût pur.</p>
</div>

<h3>Ramener moins de données</h3>

<p>Un <code>SELECT *</code> sur une entité qui porte trente colonnes, dont un champ texte volumineux, pour n'afficher qu'un nom et une date : c'est du transfert et de la mémoire gaspillés à chaque appel. Les projections règlent le problème.</p>

<div class="code">
  <div class="code-head"><span>Projection DTO</span><span>Java 21</span></div>
<pre><span class="c">// Un record, et Hibernate ne sélectionne que ces trois colonnes</span>
<span class="k">public record</span> <span class="t">ContratResume</span>(<span class="t">Long</span> id, <span class="t">String</span> reference, <span class="t">LocalDate</span> dateEffet) {}

<span class="a">@Query</span>(<span class="s">"""
    select new dev.charrad.contrat.ContratResume(c.id, c.reference, c.dateEffet)
    from Contrat c
    where c.client.id = :clientId
    """</span>)
<span class="t">Page</span>&lt;<span class="t">ContratResume</span>&gt; resumesParClient(<span class="a">@Param</span>(<span class="s">"clientId"</span>) <span class="t">Long</span> clientId, <span class="t">Pageable</span> page);</pre>
</div>

<p>Et paginez systématiquement. Un endpoint qui renvoie « tous les contrats » fonctionne parfaitement jusqu'au jour où un client en a quarante mille.</p>

<h2><span class="num">03 — Couche backend</span>Le pool, la sérialisation, la mémoire</h2>

<p>Une fois le SQL assaini, le backend devient visible. Trois points reviennent.</p>

<p><strong>Le pool de connexions mal dimensionné.</strong> Contre-intuitivement, un pool trop grand dégrade les performances : la base passe son temps à arbitrer entre des connexions concurrentes au lieu de traiter. Un ordre de grandeur raisonnable se situe entre dix et vingt connexions par instance applicative, à ajuster en observant le temps d'acquisition plutôt qu'en le devinant.</p>

<div class="code">
  <div class="code-head"><span>application.yml</span><span>YAML</span></div>
<pre><span class="a">spring</span>:
  <span class="a">datasource</span>:
    <span class="a">hikari</span>:
      <span class="a">maximum-pool-size</span>: <span class="s">15</span>
      <span class="a">minimum-idle</span>: <span class="s">5</span>
      <span class="a">connection-timeout</span>: <span class="s">3000</span>   <span class="c"># échouer vite plutôt qu'empiler</span>
      <span class="a">leak-detection-threshold</span>: <span class="s">20000</span></pre>
</div>

<p>Surveillez <code>hikaricp_connections_acquire_seconds</code>. S'il monte, ce n'est pas forcément qu'il faut agrandir le pool — c'est souvent que les requêtes sont trop lentes et gardent les connexions trop longtemps. Agrandir le pool à ce moment-là déplace le problème vers la base.</p>

<p><strong>La sérialisation JSON.</strong> Sur de gros tableaux, elle devient mesurable. Deux réflexes suffisent : ne pas exposer les entités directement — vous sérialisez alors des associations dont vous n'avez pas besoin — et éviter les formats coûteux. Un <code>BigDecimal</code> sérialisé en chaîne pour trente mille lignes se voit dans le profil.</p>

<p><strong>La mémoire.</strong> Charger cent mille entités pour en agréger trois champs sature le tas et déclenche des pauses de ramasse-miettes. Faites l'agrégation en SQL, ou traitez par lots avec <code>Stream</code> et un <code>fetch size</code> adapté.</p>

<h2><span class="num">04 — Cache</span>Trois niveaux, trois usages différents</h2>

<p>Le cache est l'optimisation la plus rentable et la plus dangereuse : il masque les problèmes au lieu de les résoudre, et introduit une classe de bugs entièrement nouvelle. On l'ajoute <em>après</em> avoir corrigé le SQL, jamais avant.</p>

<figure>
<svg viewBox="0 0 760 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Les trois niveaux de cache : local, distribué et second niveau Hibernate">
  <rect width="760" height="300" fill="#0D1524"/>
  <g stroke="#2A3A5C" stroke-width="1" opacity=".3">
    <path d="M0 50H760M0 100H760M0 150H760M0 200H760M0 250H760"/>
    <path d="M60 0V300M160 0V300M260 0V300M360 0V300M460 0V300M560 0V300M660 0V300"/>
  </g>

  <text x="24" y="36" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#FFFFFF">DU PLUS RAPIDE AU PLUS LOIN</text>

  <rect x="24" y="56" width="220" height="120" rx="10" fill="#0F2419" stroke="#16A75C" stroke-width="2.5"/>
  <text x="134" y="82" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#8FE0B0">LOCAL — Caffeine</text>
  <text x="134" y="104" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#C3D0E6">&lt; 1 µs</text>
  <text x="44" y="128" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#8FA3C8">référentiels, paramétrage</text>
  <text x="44" y="146" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#8FA3C8">données quasi immuables</text>
  <text x="44" y="164" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#F3A8B0">✕ non partagé entre instances</text>

  <rect x="268" y="56" width="220" height="120" rx="10" fill="#17223A" stroke="#3566E8" stroke-width="2.5"/>
  <text x="378" y="82" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#8FB2FF">DISTRIBUÉ — Redis</text>
  <text x="378" y="104" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#C3D0E6">~ 1 ms</text>
  <text x="288" y="128" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#8FA3C8">sessions, calculs coûteux</text>
  <text x="288" y="146" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#8FA3C8">partagé entre instances</text>
  <text x="288" y="164" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#F3A8B0">✕ un composant de plus</text>

  <rect x="512" y="56" width="224" height="120" rx="10" fill="#241C11" stroke="#EFA02B" stroke-width="2.5"/>
  <text x="624" y="82" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#F6C784">HIBERNATE L2</text>
  <text x="624" y="104" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#C3D0E6">niveau entité</text>
  <text x="532" y="128" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#8FA3C8">entités très lues, peu écrites</text>
  <text x="532" y="146" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#8FA3C8">transparent pour le code</text>
  <text x="532" y="164" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#F3A8B0">✕ invalidation délicate</text>

  <rect x="24" y="200" width="712" height="34" rx="8" fill="#1E1420" stroke="#E23D4E" stroke-width="1.5"/>
  <text x="380" y="222" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#F3A8B0">Ne cachez jamais : données personnelles par utilisateur, soldes, stocks, droits d'accès.</text>

  <rect x="24" y="246" width="712" height="34" rx="8" fill="#17223A" stroke="#2A3A5C"/>
  <text x="380" y="268" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#C3D0E6">La question n'est pas « que cacher » mais « comment j'invalide ».</text>
</svg>
<figcaption><b>Fig. 2</b> — Choisissez le niveau selon la nature de la donnée, pas selon la mode. Un référentiel de codes postaux et un solde bancaire n'ont rien à faire au même endroit.</figcaption>
</figure>

<div class="code">
  <div class="code-head"><span>Cache local avec TTL</span><span>Java 21</span></div>
<pre><span class="a">@Configuration</span>
<span class="a">@EnableCaching</span>
<span class="k">public class</span> <span class="t">CacheConfig</span> {

    <span class="a">@Bean</span>
    <span class="t">CacheManager</span> cacheManager() {
        <span class="t">CaffeineCacheManager</span> manager = <span class="k">new</span> <span class="t">CaffeineCacheManager</span>(<span class="s">"referentiels"</span>);
        manager.setCaffeine(<span class="t">Caffeine</span>.newBuilder()
            .maximumSize(<span class="s">10_000</span>)
            .expireAfterWrite(<span class="t">Duration</span>.ofMinutes(<span class="s">30</span>))
            .recordStats());          <span class="c">// pour exposer le taux de succès</span>
        <span class="k">return</span> manager;
    }
}

<span class="a">@Service</span>
<span class="k">public class</span> <span class="t">ReferentielService</span> {

    <span class="a">@Cacheable</span>(value = <span class="s">"referentiels"</span>, key = <span class="s">"#code"</span>)
    <span class="k">public</span> <span class="t">Garantie</span> parCode(<span class="t">String</span> code) {
        <span class="k">return</span> repository.findByCode(code).orElseThrow();
    }

    <span class="a">@CacheEvict</span>(value = <span class="s">"referentiels"</span>, key = <span class="s">"#garantie.code"</span>)
    <span class="k">public</span> <span class="t">Garantie</span> mettreAJour(<span class="t">Garantie</span> garantie) {
        <span class="k">return</span> repository.save(garantie);
    }
}</pre>
</div>

<p>Le <code>recordStats()</code> n'est pas décoratif : sans taux de succès, vous ne savez pas si votre cache sert. Un cache à 20 % de succès ajoute de la complexité et de la mémoire pour presque rien — et il faut soit le régler, soit le retirer.</p>

<div class="note warn">
  <span class="lbl">L'effet troupeau</span>
  <p>Quand une entrée très demandée expire, toutes les requêtes en cours partent simultanément vers la base pour la recalculer. Sous charge, ce pic suffit à faire tomber le service — précisément au moment où il est le plus sollicité. Deux parades : décaler les expirations avec une composante aléatoire, ou rafraîchir en arrière-plan avec <code>refreshAfterWrite</code> plutôt que d'expirer sèchement.</p>
</div>

<h2><span class="num">05 — Couche réseau</span>Compresser, cacher, envoyer moins</h2>

<p>Une réponse JSON de 800 Ko sur une connexion mobile, c'est plusieurs secondes que votre backend n'explique pas — et qui n'apparaîtront dans aucune de vos métriques serveur.</p>

<h3>La compression, en deux lignes</h3>

<div class="code">
  <div class="code-head"><span>application.yml</span><span>YAML</span></div>
<pre><span class="a">server</span>:
  <span class="a">compression</span>:
    <span class="a">enabled</span>: <span class="s">true</span>
    <span class="a">mime-types</span>: application/json,application/xml,text/html,text/css,text/javascript
    <span class="c"># En dessous, le coût CPU dépasse le gain de transfert</span>
    <span class="a">min-response-size</span>: <span class="s">2048</span></pre>
</div>

<p>Sur du JSON, très redondant par nature, gzip divise couramment la taille par cinq ou plus. Si vous avez nginx devant — c'est probable — activez-y plutôt Brotli, qui compresse mieux que gzip à coût comparable, avec repli automatique pour les rares clients qui ne le supportent pas.</p>

<div class="code">
  <div class="code-head"><span>nginx</span><span>nginx</span></div>
<pre>gzip on;
gzip_comp_level 6;
gzip_min_length 1024;
gzip_types application/json application/javascript text/css text/plain;
gzip_vary on;

<span class="c"># Si le module Brotli est disponible</span>
brotli on;
brotli_comp_level 5;
brotli_types application/json application/javascript text/css;</pre>
</div>

<div class="note">
  <span class="lbl">Un seuil, pas un réglage maximal</span>
  <p>Ne montez pas <code>gzip_comp_level</code> à 9 : le gain de taille au-delà de 6 est marginal, le coût CPU croît fortement, et sur du contenu dynamique vous ajoutez de la latence à chaque réponse. Le niveau 6 est le compromis retenu par défaut à peu près partout, et pour une bonne raison.</p>
</div>

<h3>Ne pas renvoyer ce qui n'a pas changé</h3>

<p>Pour les ressources statiques générées avec une empreinte dans le nom de fichier, le navigateur peut les garder indéfiniment — leur nom change à chaque build.</p>

<div class="code">
  <div class="code-head"><span>En-têtes de cache</span><span>nginx</span></div>
<pre><span class="c"># Fichiers versionnés par le build : main-A7F3B2.js</span>
location ~* \.(js|css|woff2)$ {
    add_header Cache-Control <span class="s">"public, max-age=31536000, immutable"</span>;
}

<span class="c"># index.html : jamais en cache, sinon le déploiement suivant n'arrive pas</span>
location = /index.html {
    add_header Cache-Control <span class="s">"no-cache"</span>;
}</pre>
</div>

<p>Pour les réponses d'API, l'<code>ETag</code> permet au serveur de répondre <code>304 Not Modified</code> sans corps. Attention toutefois : le filtre standard de Spring calcule l'empreinte <em>après</em> avoir généré la réponse. Vous économisez de la bande passante, pas du travail serveur. Utile sur mobile, sans effet sur votre charge CPU.</p>

<h2><span class="num">06 — Couche navigateur</span>La moitié du temps perçu</h2>

<p>C'est la couche que les développeurs backend regardent en dernier, et elle pèse souvent autant que toutes les autres réunies.</p>

<h3>Le poids du bundle</h3>

<div class="code">
  <div class="code-head"><span>Analyse</span><span>Shell</span></div>
<pre>ng build --configuration production --stats-json
npx source-map-explorer dist/**/*.js</pre>
</div>

<p>Vous y découvrirez généralement une bibliothèque de dates complète importée pour formater trois valeurs, ou un jeu d'icônes entier pour en afficher huit. Posez ensuite des budgets dans <code>angular.json</code> : la compilation échouera d'elle-même si quelqu'un fait entrer 300 Ko sans s'en rendre compte.</p>

<div class="code">
  <div class="code-head"><span>angular.json</span><span>JSON</span></div>
<pre><span class="s">"budgets"</span>: [
  {
    <span class="s">"type"</span>: <span class="s">"initial"</span>,
    <span class="s">"maximumWarning"</span>: <span class="s">"500kb"</span>,
    <span class="s">"maximumError"</span>: <span class="s">"800kb"</span>
  },
  {
    <span class="s">"type"</span>: <span class="s">"anyComponentStyle"</span>,
    <span class="s">"maximumWarning"</span>: <span class="s">"4kb"</span>
  }
]</pre>
</div>

<h3>Charger plus tard ce qui n'est pas visible</h3>

<div class="code">
  <div class="code-head"><span>Chargement différé</span><span>Angular</span></div>
<pre><span class="c">// Routes : chaque section devient un fragment séparé</span>
<span class="k">export const</span> routes: <span class="t">Routes</span> = [
  { path: <span class="s">'contrats'</span>,
    loadComponent: () =&gt; <span class="k">import</span>(<span class="s">'./contrats/liste.component'</span>)
                          .then(m =&gt; m.<span class="t">ListeComponent</span>) },
  { path: <span class="s">'admin'</span>,
    loadChildren: () =&gt; <span class="k">import</span>(<span class="s">'./admin/routes'</span>).then(m =&gt; m.routes) }
];</pre>
</div>

<div class="code">
  <div class="code-head"><span>Dans le template</span><span>Angular</span></div>
<pre><span class="c">&lt;!-- Le graphique n'est chargé qu'en entrant dans le champ de vision --&gt;</span>
&#64;defer (on viewport) {
  &lt;app-graphique-primes /&gt;
} &#64;placeholder {
  &lt;div class="squelette"&gt;&lt;/div&gt;
}</pre>
</div>

<p>Trois autres réflexes valent le détour : <code>NgOptimizedImage</code> pour dimensionner et prioriser correctement les images, la virtualisation pour les listes de plus de quelques centaines de lignes, et <code>OnPush</code> ou le mode zoneless pour éviter les cycles de détection inutiles.</p>

<h2><span class="num">07 — Diagnostic</span>Du symptôme à la couche</h2>

<div class="table-scroll">
<table>
  <thead><tr><th>Symptôme</th><th>Où chercher en premier</th></tr></thead>
  <tbody>
    <tr><td>Lent uniquement chez certains clients</td><td>Volumétrie : index manquant, absence de pagination. Le plan change avec la taille des données.</td></tr>
    <tr><td>Lent au premier appel, rapide ensuite</td><td>Cache froid, connexions à établir, ou compilation JIT si c'est juste après un démarrage.</td></tr>
    <tr><td>Se dégrade dans la journée</td><td>Fuite mémoire, cache sans limite de taille, pool de connexions qui n'est pas rendu.</td></tr>
    <tr><td>Rapide en local, lent en production</td><td>Latence réseau, volumétrie réelle, absence de compression, ou un saut de proxy supplémentaire.</td></tr>
    <tr><td>Le serveur répond vite, la page reste lente</td><td>Couche navigateur : bundle, rendu, images non dimensionnées.</td></tr>
    <tr><td>Lent uniquement sous charge</td><td>Contention : pool saturé, verrous en base, ramasse-miettes, saturation des threads.</td></tr>
  </tbody>
</table>
</div>

<h2><span class="num">08 — Terrain</span>Cinq erreurs de méthode</h2>

<div class="pitfall">
  <div class="no">01</div>
  <div>
    <h4>Optimiser sans profil de départ</h4>
    <p>Sans mesure initiale, vous ne saurez pas si vous avez gagné, ni de combien. La moitié des optimisations « évidentes » n'apportent rien de mesurable — et vous n'en saurez jamais rien.</p>
  </div>
</div>

<div class="pitfall">
  <div class="no">02</div>
  <div>
    <h4>Ajouter du cache pour masquer une requête lente</h4>
    <p>La requête reste lente ; elle est simplement moins souvent appelée. Au premier vidage de cache, au déploiement suivant ou sur une nouvelle instance, le problème réapparaît en pleine charge.</p>
  </div>
</div>

<div class="pitfall">
  <div class="no">03</div>
  <div>
    <h4>Tester la performance sur un jeu de données de développement</h4>
    <p>Mille lignes ne révèlent aucun index manquant. Il faut un jeu de données de volume réaliste, ou au minimum une copie anonymisée de la production.</p>
  </div>
</div>

<div class="pitfall">
  <div class="no">04</div>
  <div>
    <h4>Agrandir le pool de connexions dès que ça coince</h4>
    <p>C'est le réflexe qui aggrave le plus souvent la situation. Si le temps d'acquisition monte, la cause est généralement en aval : des requêtes trop lentes qui retiennent les connexions.</p>
  </div>
</div>

<div class="pitfall">
  <div class="no">05</div>
  <div>
    <h4>Optimiser la moyenne</h4>
    <p>Les utilisateurs mécontents sont dans le P99. Une moyenne qui passe de 180 à 150 ms ne change l'expérience de personne ; un P99 qui passe de 4 s à 900 ms change celle de vos plus gros comptes.</p>
  </div>
</div>

<h2><span class="num">09 — Récapitulatif</span>La fiche à garder sous la main</h2>

<div class="cheat">
  <h3>Optimisation Java — l'essentiel</h3>
  <p class="sub">Spring Boot · Hibernate · PostgreSQL · Angular</p>
  <div class="cheat-grid">
    <div class="cheat-card c-db">
      <div class="h">● BASE</div>
      <ul>
        <li>N+1 → <code>join fetch</code>, <code>@EntityGraph</code></li>
        <li><code>EXPLAIN (ANALYZE, BUFFERS)</code></li>
        <li>Index composite : égalité puis tri</li>
        <li>Projections + pagination</li>
      </ul>
    </div>
    <div class="cheat-card c-back">
      <div class="h">● BACKEND</div>
      <ul>
        <li><code>open-in-view: false</code></li>
        <li><code>default_batch_fetch_size: 50</code></li>
        <li>Pool : 10–20, surveiller l'acquisition</li>
        <li>Agréger en SQL, pas en mémoire</li>
      </ul>
    </div>
    <div class="cheat-card">
      <div class="h">⚙ CACHE</div>
      <ul>
        <li>Après le SQL, jamais avant</li>
        <li>TTL + <code>recordStats()</code></li>
        <li><code>refreshAfterWrite</code> contre l'effet troupeau</li>
      </ul>
    </div>
    <div class="cheat-card c-net">
      <div class="h">● RÉSEAU</div>
      <ul>
        <li>gzip / brotli, niveau 5–6</li>
        <li><code>immutable</code> sur les assets versionnés</li>
        <li><code>no-cache</code> sur index.html</li>
      </ul>
    </div>
    <div class="cheat-card c-front">
      <div class="h">● NAVIGATEUR</div>
      <ul>
        <li>Budgets dans <code>angular.json</code></li>
        <li><code>loadComponent</code>, <code>@defer</code></li>
        <li><code>NgOptimizedImage</code>, virtualisation</li>
      </ul>
    </div>
    <div class="cheat-card">
      <div class="h">◉ MESURER</div>
      <ul>
        <li>P50 / P95 / P99, jamais la moyenne</li>
        <li><code>pg_stat_statements</code></li>
        <li>Micrometer + JFR + Lighthouse</li>
      </ul>
    </div>
  </div>
</div>

<h2><span class="num">10 — Pour finir</span>L'ordre compte plus que les techniques</h2>

<p>Toutes les techniques de cet article se trouvent dans la documentation. Ce qui distingue une optimisation efficace d'un chantier qui s'éternise, c'est l'ordre : mesurer, corriger la couche dominante, remesurer, recommencer.</p>

<p>Sauter la mesure, c'est presque toujours passer une semaine sur les 3 % du temps qu'on comprenait le mieux — parce que c'était la partie du code qu'on avait écrite soi-même.</p>

<p>Et il faut savoir s'arrêter. Une page qui répond en 200 ms n'a pas besoin de descendre à 150. Le temps ainsi gagné n'a aucune valeur perceptible pour l'utilisateur, alors qu'il en a beaucoup ailleurs dans le projet.</p>

<div class="bio">
  <div class="who">Amine Charrad</div>
  <p>12 ans de développement fullstack Java et Angular. Tech Lead, actuellement sur des applications à fort trafic dans le secteur de l'assurance. J'écris ici sur Java, Spring, Angular et tout ce qui se passe entre le code et la production — <a href="https://charrad.dev">charrad.dev</a></p>
</div>

</div>
</main>
</body>
</html>
$article$,
    'HTML',
    'https://charrad.dev/assets/images/articles/optimiser-application-java.png',
    'PUBLISHED',
    NOW(),
    u.id,
    NOW(),
    NOW()
FROM users u WHERE u.email = 'admin@portfolio.dev'
ON CONFLICT (slug) DO NOTHING;
