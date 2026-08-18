-- =============================================================================
-- V14__add_threads_virtuels_article.sql — Publie l'article "Threads virtuels"
-- =============================================================================
-- Article "HTML designé" : le contenu est un document HTML autonome (avec ses
-- propres <style> et polices Google Fonts), rendu côté frontend dans un Shadow
-- DOM par RichHtmlArticleComponent — d'où content_type = 'HTML'.
--
-- Le corps de l'article est délimité par un dollar-quoting pour éviter d'avoir
-- à doubler les centaines d'apostrophes du HTML (le délimiteur lui-même n'est
-- volontairement cité nulle part ailleurs dans ce fichier, y compris en
-- commentaire, pour ne pas risquer de perturber le parseur de Flyway).
--
-- L'image de couverture est servie en statique par le frontend
-- (frontend/src/assets/images/articles/), son URL est absolue car elle sert
-- aussi de og:image (les crawlers sociaux n'acceptent pas les chemins relatifs).
-- =============================================================================

INSERT INTO articles (title, slug, summary, content, content_type, cover_image_url, status, published_at, user_id, created_at, updated_at)
SELECT
    'Threads virtuels : une ligne de configuration, et le goulot se déplace',
    'threads-virtuels-java21',
    'Activer les threads virtuels tient en une propriété. Comprendre où votre application va coincer ensuite demande un peu plus de travail — et c''est là que se joue le vrai gain.',
    $article$
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Threads virtuels en Java 21 : une ligne de configuration, et le goulot se déplace</title>
<meta name="description" content="Comprendre les threads virtuels de Java 21 dans une application Spring Boot : montage sur carrier thread, pinning, pools de connexions, ThreadLocal, et les cas où ils n'apportent rien.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{
  --ink:#0D1524;
  --ink-soft:#17223A;
  --ink-line:#2A3A5C;

  --paper:#FFFFFF;
  --wash:#EEF2F8;
  --rule:#D5DEEC;
  --text:#161E2E;
  --muted:#5A6883;

  /* Langage visuel de cet article */
  --virtual:#16A75C;      /* thread virtuel */
  --virtual-soft:#E4F6EC;
  --carrier:#3566E8;      /* carrier / thread plateforme */
  --carrier-soft:#E7EDFD;
  --pinned:#E23D4E;       /* pinning, blocage */
  --pinned-soft:#FCE8EA;
  --io:#EFA02B;           /* attente I/O */
  --io-soft:#FDF1DD;

  --volt:#3566E8;
  --volt-soft:#E7EDFD;

  --display:"Space Grotesk",system-ui,sans-serif;
  --body:"Source Serif 4",Georgia,serif;
  --mono:"JetBrains Mono",ui-monospace,Menlo,monospace;
}

*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;background:var(--paper);color:var(--text);
  font-family:var(--body);font-size:19px;line-height:1.68;
  -webkit-font-smoothing:antialiased;
}
.wrap{max-width:760px;margin:0 auto;padding:0 24px}

.hero{background:var(--ink);color:#fff;padding:72px 0 64px;position:relative;overflow:hidden}
.hero::after{
  content:"";position:absolute;inset:0;
  background-image:linear-gradient(var(--ink-line) 1px,transparent 1px),linear-gradient(90deg,var(--ink-line) 1px,transparent 1px);
  background-size:44px 44px;opacity:.35;
  mask-image:radial-gradient(ellipse 70% 80% at 70% 20%,#000,transparent 75%);
  -webkit-mask-image:radial-gradient(ellipse 70% 80% at 70% 20%,#000,transparent 75%);
  pointer-events:none;
}
.hero .wrap{position:relative;z-index:1}
.eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#7E93BC;margin:0 0 20px}
.hero h1{font-family:var(--display);font-weight:700;font-size:clamp(34px,6vw,54px);line-height:1.08;letter-spacing:-.02em;margin:0 0 20px}
.hero h1 em{font-style:normal;color:var(--virtual)}
.standfirst{font-size:20px;color:#BECBE2;margin:0 0 32px;max-width:58ch}
.byline{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;font-family:var(--mono);font-size:12.5px;color:#8FA3C8;border-top:1px solid var(--ink-line);padding-top:18px}
.byline b{color:#fff;font-weight:500}

.states-strip{background:var(--ink-soft);border-top:1px solid var(--ink-line)}
.states-strip .wrap{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;padding:0}
.state-chip{padding:18px 20px;background:var(--ink-soft)}
.state-chip .dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:8px}
.state-chip .nm{font-family:var(--mono);font-size:13px;font-weight:700;color:#fff;letter-spacing:.04em}
.state-chip .ds{font-family:var(--body);font-size:14px;color:#93A6C9;margin-top:4px;line-height:1.4}

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
.k{color:#7FA9FF}.s{color:#8DE0A6}.c{color:#6B7FA3;font-style:italic}.a{color:#F2C46B}.t{color:#6FD2E2}

.note{border-left:4px solid var(--volt);background:var(--volt-soft);padding:16px 20px;border-radius:0 8px 8px 0;margin:26px 0;font-size:17.5px}
.note .lbl{font-family:var(--mono);font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--volt);display:block;margin-bottom:6px;font-weight:700}
.note p:last-child{margin-bottom:0}
.note.warn{border-color:var(--pinned);background:var(--pinned-soft)}
.note.warn .lbl{color:var(--pinned)}
.note.good{border-color:var(--virtual);background:var(--virtual-soft)}
.note.good .lbl{color:var(--virtual)}

.table-scroll{overflow-x:auto;margin:26px 0;border:1px solid var(--rule);border-radius:10px}
table{border-collapse:collapse;width:100%;font-size:15.5px;min-width:560px}
th{background:var(--wash);font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;text-align:left;padding:12px 16px;color:var(--muted);font-weight:700;border-bottom:1px solid var(--rule)}
td{padding:13px 16px;border-bottom:1px solid var(--rule);vertical-align:top;line-height:1.5}
tr:last-child td{border-bottom:0}
td:first-child{width:34%}

.pitfall{display:grid;grid-template-columns:44px 1fr;gap:16px;padding:20px 0;border-bottom:1px solid var(--rule)}
.pitfall:last-of-type{border-bottom:0}
.pitfall .no{font-family:var(--mono);font-size:15px;font-weight:700;color:var(--pinned);background:var(--pinned-soft);border-radius:8px;height:36px;display:grid;place-items:center}
.pitfall h4{font-family:var(--display);font-size:18px;font-weight:600;margin:4px 0 6px}
.pitfall p{margin:0;font-size:17px}

.cheat{background:var(--ink);border-radius:14px;padding:32px;margin:44px 0;color:#fff}
.cheat h3{color:#fff;margin:0 0 4px;font-size:24px}
.cheat .sub{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#7E93BC;margin:0 0 26px}
.cheat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
.cheat-card{background:var(--ink-soft);border-radius:10px;padding:16px 18px;border-top:3px solid var(--volt)}
.cheat-card.c-virtual{border-color:var(--virtual)}
.cheat-card.c-pinned{border-color:var(--pinned)}
.cheat-card.c-io{border-color:var(--io)}
.cheat-card .h{font-family:var(--mono);font-size:12.5px;font-weight:700;letter-spacing:.06em;margin-bottom:8px}
.c-virtual .h{color:var(--virtual)}
.c-pinned .h{color:var(--pinned)}
.c-io .h{color:var(--io)}
.cheat-card ul{margin:0;padding-left:16px;font-size:14.5px;line-height:1.5;color:#C3D0E6}
.cheat-card li{margin-bottom:5px}
.cheat-card li::marker{color:#5B6E93}
.cheat-card code{background:#0D1524;border-color:#2A3A5C;color:#F2C46B;font-size:12px;overflow-wrap:anywhere;word-break:break-word;max-width:100%;display:inline-block}

.bio{border-top:2px solid var(--text);margin-top:64px;padding:26px 0 72px;display:grid;grid-template-columns:1fr;gap:6px}
.bio .who{font-family:var(--display);font-weight:600;font-size:19px}
.bio p{font-size:17px;color:var(--muted);margin:0}

@media (max-width:640px){
  body{font-size:18px}
  .states-strip .wrap{grid-template-columns:1fr}
  .state-chip{border-bottom:1px solid var(--ink-line)}
  .cheat{padding:24px 20px;border-radius:0;margin-left:-24px;margin-right:-24px}
  .pitfall{grid-template-columns:36px 1fr;gap:12px}
}
@media (prefers-reduced-motion:no-preference){
  .pulse{animation:pulse 2.6s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
}
</style>
</head>
<body>

<header class="hero">
  <div class="wrap">
    <p class="eyebrow">Java 21 · Spring Boot 3.2+ · Concurrence</p>
    <h1>Threads virtuels : une ligne de configuration, et le goulot <em>se déplace</em></h1>
    <p class="standfirst">Activer les threads virtuels tient en une propriété. Comprendre où votre application va coincer ensuite demande un peu plus de travail — et c'est là que se joue le vrai gain.</p>
    <div class="byline">
      <span>Par <b>Amine Charrad</b></span>
      <span>·</span>
      <span>16 min de lecture</span>
      <span>·</span>
      <span>Java 21 · Spring Boot 3.3 · Tomcat</span>
    </div>
  </div>
</header>

<div class="states-strip">
  <div class="wrap">
    <div class="state-chip">
      <div class="nm"><span class="dot" style="background:#16A75C"></span>THREAD VIRTUEL</div>
      <div class="ds">Géré par la JVM. Quelques centaines d'octets. On peut en créer des millions.</div>
    </div>
    <div class="state-chip">
      <div class="nm"><span class="dot" style="background:#3566E8"></span>CARRIER THREAD</div>
      <div class="ds">Un vrai thread système. Il porte les threads virtuels à tour de rôle.</div>
    </div>
    <div class="state-chip">
      <div class="nm"><span class="dot" style="background:#E23D4E"></span>PINNING</div>
      <div class="ds">Le thread virtuel reste collé à son carrier. Tout le bénéfice disparaît.</div>
    </div>
  </div>
</div>

<main>
<div class="wrap">

<p>Le modèle de concurrence de Java n'avait pas bougé depuis vingt ans : une requête, un thread. Ce thread appartient au système d'exploitation, il coûte cher, et vous en avez donc un nombre limité — deux cents, cinq cents, rarement plus.</p>

<p>Tant que le travail est court, ça tient. Dès qu'il consiste à attendre — une base, une API tierce, un fichier — le modèle s'effondre.</p>

<h2><span class="num">01 — Le problème</span>Attendre coûte un thread entier</h2>

<p>Prenez une API qui appelle trois services en cascade. Chaque requête passe 95 % de son temps à ne rien faire : elle attend une réponse réseau. Pendant ce temps, son thread est immobilisé, il consomme sa pile mémoire, et il n'est disponible pour personne d'autre.</p>

<p>Un thread plateforme réserve typiquement autour d'un mégaoctet de pile. Deux cents threads, c'est déjà 200 Mo qui ne servent qu'à attendre. Monter à dix mille threads n'est pas une option : la mémoire explose et l'ordonnanceur du système passe son temps à basculer d'un contexte à l'autre.</p>

<p>D'où le paradoxe bien connu : votre serveur affiche 4 % de CPU et refuse pourtant des requêtes.</p>

<figure>
<svg viewBox="0 0 760 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Comparaison entre le modèle un-thread-par-requête et les threads virtuels">
  <rect width="760" height="340" fill="#0D1524"/>
  <g stroke="#2A3A5C" stroke-width="1" opacity=".35">
    <path d="M0 40H760M0 80H760M0 120H760M0 160H760M0 200H760M0 240H760M0 280H760M0 320H760"/>
    <path d="M40 0V340M120 0V340M200 0V340M280 0V340M360 0V340M440 0V340M520 0V340M600 0V340M680 0V340M740 0V340"/>
  </g>

  <!-- séparateur central -->
  <path d="M380 24V316" stroke="#2A3A5C" stroke-width="1.5" stroke-dasharray="5 6"/>

  <!-- GAUCHE : threads plateforme -->
  <text x="30" y="42" font-family="JetBrains Mono, monospace" font-size="13" font-weight="700" fill="#FFFFFF">THREADS PLATEFORME</text>
  <text x="30" y="60" font-family="JetBrains Mono, monospace" font-size="11" fill="#7E93BC">1 requête = 1 thread OS</text>

  <g>
    <rect x="30" y="80" width="14" height="120" rx="3" fill="#3566E8" opacity=".85"/>
    <rect x="52" y="80" width="14" height="120" rx="3" fill="#3566E8" opacity=".85"/>
    <rect x="74" y="80" width="14" height="120" rx="3" fill="#3566E8" opacity=".85"/>
    <rect x="96" y="80" width="14" height="120" rx="3" fill="#3566E8" opacity=".85"/>
    <rect x="118" y="80" width="14" height="120" rx="3" fill="#3566E8" opacity=".85"/>
    <rect x="140" y="80" width="14" height="120" rx="3" fill="#3566E8" opacity=".85"/>
    <rect x="162" y="80" width="14" height="120" rx="3" fill="#3566E8" opacity=".85"/>
    <rect x="184" y="80" width="14" height="120" rx="3" fill="#3566E8" opacity=".85"/>
  </g>
  <rect x="212" y="80" width="132" height="120" rx="6" fill="#1E1420" stroke="#E23D4E" stroke-width="1.5" stroke-dasharray="5 4"/>
  <text x="278" y="128" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#F3A8B0">requêtes</text>
  <text x="278" y="146" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#F3A8B0">refusées</text>
  <text x="278" y="166" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#8FA3C8">file pleine</text>

  <text x="30" y="228" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#C3D0E6">200 threads · ~200 Mo de piles</text>
  <text x="30" y="248" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#EFA02B">95 % du temps à attendre</text>
  <text x="30" y="268" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#7E93BC">CPU mesuré : 4 %</text>

  <!-- DROITE : threads virtuels -->
  <text x="410" y="42" font-family="JetBrains Mono, monospace" font-size="13" font-weight="700" fill="#FFFFFF">THREADS VIRTUELS</text>
  <text x="410" y="60" font-family="JetBrains Mono, monospace" font-size="11" fill="#7E93BC">1 requête = 1 thread JVM</text>

  <g fill="#16A75C">
    <rect x="410" y="80" width="6" height="52" rx="2"/><rect x="420" y="80" width="6" height="52" rx="2"/>
    <rect x="430" y="80" width="6" height="52" rx="2"/><rect x="440" y="80" width="6" height="52" rx="2"/>
    <rect x="450" y="80" width="6" height="52" rx="2"/><rect x="460" y="80" width="6" height="52" rx="2"/>
    <rect x="470" y="80" width="6" height="52" rx="2"/><rect x="480" y="80" width="6" height="52" rx="2"/>
    <rect x="490" y="80" width="6" height="52" rx="2"/><rect x="500" y="80" width="6" height="52" rx="2"/>
    <rect x="510" y="80" width="6" height="52" rx="2"/><rect x="520" y="80" width="6" height="52" rx="2"/>
    <rect x="530" y="80" width="6" height="52" rx="2"/><rect x="540" y="80" width="6" height="52" rx="2"/>
    <rect x="550" y="80" width="6" height="52" rx="2"/><rect x="560" y="80" width="6" height="52" rx="2"/>
    <rect x="570" y="80" width="6" height="52" rx="2"/><rect x="580" y="80" width="6" height="52" rx="2"/>
    <rect x="590" y="80" width="6" height="52" rx="2"/><rect x="600" y="80" width="6" height="52" rx="2"/>
    <rect x="610" y="80" width="6" height="52" rx="2"/><rect x="620" y="80" width="6" height="52" rx="2"/>
    <rect x="630" y="80" width="6" height="52" rx="2"/><rect x="640" y="80" width="6" height="52" rx="2"/>
    <rect x="650" y="80" width="6" height="52" rx="2"/><rect x="660" y="80" width="6" height="52" rx="2"/>
    <rect x="670" y="80" width="6" height="52" rx="2"/><rect x="680" y="80" width="6" height="52" rx="2"/>
    <rect x="690" y="80" width="6" height="52" rx="2"/><rect x="700" y="80" width="6" height="52" rx="2"/>
    <rect x="710" y="80" width="6" height="52" rx="2"/><rect x="720" y="80" width="6" height="52" rx="2"/>
  </g>
  <text x="730" y="110" font-family="JetBrains Mono, monospace" font-size="12" fill="#8FE0B0">…</text>

  <!-- carriers -->
  <text x="410" y="158" font-family="JetBrains Mono, monospace" font-size="11" fill="#7E93BC">portés par</text>
  <g>
    <rect x="410" y="168" width="60" height="32" rx="5" fill="#17223A" stroke="#3566E8" stroke-width="1.5"/>
    <rect x="480" y="168" width="60" height="32" rx="5" fill="#17223A" stroke="#3566E8" stroke-width="1.5"/>
    <rect x="550" y="168" width="60" height="32" rx="5" fill="#17223A" stroke="#3566E8" stroke-width="1.5"/>
    <rect x="620" y="168" width="60" height="32" rx="5" fill="#17223A" stroke="#3566E8" stroke-width="1.5"/>
  </g>
  <text x="545" y="189" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#8FB2FF">4 carrier threads</text>

  <text x="410" y="228" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#C3D0E6">50 000 threads · quelques centaines d'octets chacun</text>
  <text x="410" y="248" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#8FE0B0">l'attente ne bloque plus de thread OS</text>
  <text x="410" y="268" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#7E93BC">CPU mesuré : 60 %</text>

  <rect x="30" y="290" width="700" height="34" rx="8" fill="#17223A" stroke="#2A3A5C"/>
  <text x="380" y="312" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" fill="#C3D0E6">Même code bloquant. Ce qui change, c'est qui supporte le coût de l'attente.</text>
</svg>
<figcaption><b>Fig. 1</b> — À gauche, chaque attente immobilise un thread système. À droite, le thread virtuel est démonté pendant l'attente et son carrier repart travailler ailleurs.</figcaption>
</figure>

<p>La réponse historique à ce problème, c'était la programmation réactive : WebFlux, Reactor, des chaînes de <code>flatMap</code> et des piles d'appels illisibles. Elle marche, mais elle vous fait réécrire l'application entière et renoncer au débogueur.</p>

<p>Les threads virtuels proposent l'inverse : garder le code bloquant, celui qui se lit de haut en bas, et faire porter le coût de l'attente à la JVM plutôt qu'au système.</p>

<h2><span class="num">02 — Le mécanisme</span>Montage, démontage, et pourquoi ça change tout</h2>

<p>Un thread virtuel n'est pas un thread du système d'exploitation. C'est un objet Java, géré par la JVM, dont la pile vit sur le tas et grandit ou rétrécit à la demande. Coût unitaire : quelques centaines d'octets au lieu d'un mégaoctet.</p>

<p>Pour s'exécuter, il doit être <strong>monté</strong> sur un vrai thread système appelé <em>carrier thread</em>. Ces carriers vivent dans un <code>ForkJoinPool</code> dédié, dont le parallélisme vaut par défaut le nombre de processeurs disponibles.</p>

<p>Le point clé tient en une phrase : quand le thread virtuel rencontre une opération bloquante — un appel réseau, une lecture en base — la JVM le <strong>démonte</strong>. Sa pile est mise de côté sur le tas, et le carrier est immédiatement rendu au pool pour porter un autre thread virtuel. Quand la réponse arrive, le thread virtuel est remonté, éventuellement sur un carrier différent, et reprend exactement où il s'était arrêté.</p>

<figure>
<svg viewBox="0 0 760 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cycle de montage et démontage d'un thread virtuel sur un carrier thread">
  <rect width="760" height="300" fill="#0D1524"/>
  <g stroke="#2A3A5C" stroke-width="1" opacity=".35">
    <path d="M0 40H760M0 80H760M0 120H760M0 160H760M0 200H760M0 240H760M0 280H760"/>
    <path d="M60 0V300M160 0V300M260 0V300M360 0V300M460 0V300M560 0V300M660 0V300"/>
  </g>

  <text x="30" y="38" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#FFFFFF">CARRIER THREAD</text>
  <path d="M30 96H730" stroke="#3566E8" stroke-width="2.5"/>

  <!-- segments d'exécution sur le carrier -->
  <rect x="60" y="76" width="130" height="40" rx="5" fill="#17223A" stroke="#16A75C" stroke-width="2"/>
  <text x="125" y="101" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#8FE0B0">VT-1 monté</text>

  <rect x="210" y="76" width="150" height="40" rx="5" fill="#17223A" stroke="#3566E8" stroke-width="2"/>
  <text x="285" y="101" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#8FB2FF">VT-2, VT-3, VT-4…</text>

  <rect x="380" y="76" width="130" height="40" rx="5" fill="#17223A" stroke="#16A75C" stroke-width="2"/>
  <text x="445" y="101" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#8FE0B0">VT-1 remonté</text>

  <rect x="530" y="76" width="200" height="40" rx="5" fill="#17223A" stroke="#3566E8" stroke-width="2"/>
  <text x="630" y="101" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#8FB2FF">autres threads virtuels</text>

  <!-- flèches de démontage / remontage -->
  <path d="M190 118 L200 158" stroke="#EFA02B" stroke-width="2" marker-end="url(#a-io)"/>
  <path d="M370 158 L380 118" stroke="#EFA02B" stroke-width="2" marker-end="url(#a-io2)"/>

  <text x="30" y="182" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#FFFFFF">THREAD VIRTUEL 1</text>
  <rect x="200" y="168" width="170" height="40" rx="5" fill="#241C11" stroke="#EFA02B" stroke-width="2"/>
  <text x="285" y="186" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#F6C784">démonté — pile sur le tas</text>
  <text x="285" y="202" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#8FA3C8">attente réseau · 40 ms</text>

  <text x="205" y="234" font-family="JetBrains Mono, monospace" font-size="11" fill="#EFA02B">démontage</text>
  <text x="316" y="234" font-family="JetBrains Mono, monospace" font-size="11" fill="#EFA02B">remontage</text>

  <rect x="30" y="252" width="700" height="34" rx="8" fill="#0F2419" stroke="#16A75C"/>
  <text x="380" y="274" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" fill="#8FE0B0">Pendant les 40 ms d'attente, aucun thread système n'est immobilisé.</text>

  <defs>
    <marker id="a-io" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9z" fill="#EFA02B"/></marker>
    <marker id="a-io2" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9z" fill="#EFA02B"/></marker>
  </defs>
</svg>
<figcaption><b>Fig. 2</b> — Le carrier n'attend jamais. Il exécute des portions de threads virtuels, et passe au suivant dès que l'un d'eux se bloque sur une entrée-sortie.</figcaption>
</figure>

<div class="note good">
  <span class="lbl">La bonne façon de le voir</span>
  <p>Les threads virtuels ne rendent pas une requête plus rapide. Ils augmentent le nombre de requêtes que vous pouvez traiter <em>en parallèle</em> pour une même machine. C'est un gain de débit, pas de latence.</p>
</div>

<h2><span class="num">03 — Activation</span>Une propriété, et c'est tout</h2>

<p>Depuis Spring Boot 3.2, sur un JDK 21 ou supérieur :</p>

<div class="code">
  <div class="code-head"><span>application.yml</span><span>YAML</span></div>
<pre><span class="a">spring</span>:
  <span class="a">threads</span>:
    <span class="a">virtual</span>:
      <span class="a">enabled</span>: <span class="s">true</span></pre>
</div>

<p>Cette seule ligne change trois choses : le conteneur web (Tomcat, Jetty) traite désormais chaque requête sur un thread virtuel ; les tâches <code>@Async</code> et planifiées passent sur des threads virtuels ; et les écouteurs de messages compatibles suivent le même chemin.</p>

<p>Votre code métier, lui, ne change pas d'une ligne. C'est tout l'intérêt.</p>

<h3>Créer des threads virtuels à la main</h3>

<p>En dehors du cycle des requêtes, l'API tient en deux formes.</p>

<div class="code">
  <div class="code-head"><span>Exemple</span><span>Java 21</span></div>
<pre><span class="c">// Un thread virtuel isolé</span>
<span class="t">Thread</span>.ofVirtual()
      .name(<span class="s">"import-contrats"</span>)
      .start(() -&gt; traiterLot(lot));

<span class="c">// Un exécuteur : un thread virtuel par tâche soumise</span>
<span class="k">try</span> (<span class="k">var</span> executor = <span class="t">Executors</span>.newVirtualThreadPerTaskExecutor()) {
    <span class="t">List</span>&lt;<span class="t">Future</span>&lt;<span class="t">Contrat</span>&gt;&gt; resultats = executor.invokeAll(
        references.stream()
                  .map(ref -&gt; (<span class="t">Callable</span>&lt;<span class="t">Contrat</span>&gt;) () -&gt; client.charger(ref))
                  .toList()
    );
}   <span class="c">// close() attend la fin de toutes les tâches</span></pre>
</div>

<p>Notez le <code>try-with-resources</code> : <code>ExecutorService</code> implémente <code>AutoCloseable</code> depuis Java 19, et la fermeture attend la terminaison des tâches. Plus besoin d'un <code>shutdown()</code> suivi d'un <code>awaitTermination()</code>.</p>

<div class="note">
  <span class="lbl">Ne les mettez jamais en pool</span>
  <p>Un thread virtuel est jetable : on en crée un par tâche, on le laisse mourir. Le mettre en pool revient à limiter artificiellement ce qui n'a plus besoin de l'être — et vous récupérez exactement le problème que vous cherchiez à éliminer. <code>newVirtualThreadPerTaskExecutor()</code> n'est pas un pool, c'est une fabrique.</p>
</div>

<h2><span class="num">04 — Le piège principal</span>Le pinning</h2>

<p>Il existe des situations où le thread virtuel <strong>ne peut pas</strong> être démonté. Il reste alors collé — <em>pinned</em> — à son carrier pendant toute l'attente. Le carrier est immobilisé, et vous retrouvez le comportement d'un thread plateforme classique, avec en prime un pool de carriers bien plus petit que votre ancien pool de threads.</p>

<figure>
<svg viewBox="0 0 760 280" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Un thread virtuel épinglé bloque son carrier thread pendant toute l'attente">
  <rect width="760" height="280" fill="#0D1524"/>
  <g stroke="#2A3A5C" stroke-width="1" opacity=".35">
    <path d="M0 40H760M0 80H760M0 120H760M0 160H760M0 200H760M0 240H760"/>
    <path d="M60 0V280M160 0V280M260 0V280M360 0V280M460 0V280M560 0V280M660 0V280"/>
  </g>

  <text x="30" y="40" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#FFFFFF">SANS PINNING</text>
  <path d="M150 58H730" stroke="#3566E8" stroke-width="2"/>
  <rect x="150" y="42" width="90" height="32" rx="5" fill="#17223A" stroke="#16A75C" stroke-width="1.5"/>
  <text x="195" y="63" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#8FE0B0">VT-1</text>
  <rect x="250" y="42" width="480" height="32" rx="5" fill="#17223A" stroke="#3566E8" stroke-width="1.5"/>
  <text x="490" y="63" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#8FB2FF">le carrier enchaîne VT-2, VT-3, VT-4, VT-5…</text>

  <text x="30" y="140" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#FFFFFF">AVEC PINNING</text>
  <path d="M150 158H730" stroke="#3566E8" stroke-width="2"/>
  <rect x="150" y="142" width="90" height="32" rx="5" fill="#17223A" stroke="#16A75C" stroke-width="1.5"/>
  <text x="195" y="163" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#8FE0B0">VT-1</text>
  <rect x="250" y="142" width="480" height="32" rx="5" fill="#1E1420" stroke="#E23D4E" stroke-width="1.5"/>
  <text x="490" y="163" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#F3A8B0" class="pulse">carrier immobilisé — VT-1 épinglé pendant toute l'attente</text>

  <rect x="30" y="196" width="700" height="60" rx="8" fill="#17223A" stroke="#2A3A5C"/>
  <text x="50" y="220" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#F3A8B0">Causes du pinning :</text>
  <text x="50" y="240" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#C3D0E6">bloc synchronized (jusqu'au JDK 23) · appel natif JNI · Object.wait()</text>
</svg>
<figcaption><b>Fig. 3</b> — Un seul thread épinglé retire un carrier du pool. Avec un parallélisme par défaut égal au nombre de cœurs, quelques épinglages simultanés suffisent à tout arrêter.</figcaption>
</figure>

<h3>La cause la plus fréquente : synchronized</h3>

<p>Jusqu'au JDK 23, se bloquer à l'intérieur d'un bloc <code>synchronized</code> épinglait le thread virtuel. C'était le piège numéro un, d'autant qu'il se cache souvent dans une bibliothèque tierce plutôt que dans votre code.</p>

<p>Le remède tenait en un remplacement mécanique :</p>

<div class="code">
  <div class="code-head"><span>Avant / après</span><span>Java 21</span></div>
<pre><span class="c">// Épingle le carrier pendant l'appel réseau</span>
<span class="k">public synchronized</span> <span class="t">Tarif</span> consulter(<span class="t">String</span> ref) {
    <span class="k">return</span> client.get(ref);
}

<span class="c">// N'épingle pas : ReentrantLock sait démonter le thread virtuel</span>
<span class="k">private final</span> <span class="t">ReentrantLock</span> verrou = <span class="k">new</span> <span class="t">ReentrantLock</span>();

<span class="k">public</span> <span class="t">Tarif</span> consulter(<span class="t">String</span> ref) {
    verrou.lock();
    <span class="k">try</span> {
        <span class="k">return</span> client.get(ref);
    } <span class="k">finally</span> {
        verrou.unlock();
    }
}</pre>
</div>

<div class="note">
  <span class="lbl">Depuis le JDK 24</span>
  <p>Le JEP 491 a supprimé cette limitation : un thread virtuel bloqué dans un bloc <code>synchronized</code> peut désormais être démonté normalement. Si vous êtes sur JDK 24 ou plus, la réécriture en <code>ReentrantLock</code> n'est plus nécessaire pour cette raison. Sur Java 21 — le cas de la majorité des applications en production aujourd'hui — elle l'est toujours.</p>
</div>

<h3>Détecter le pinning</h3>

<p>Ne le cherchez pas à la lecture du code : il vient presque toujours d'une dépendance. Mesurez-le.</p>

<p>La JVM émet un événement JFR <code>jdk.VirtualThreadPinned</code> à chaque épinglage dépassant un seuil de durée. Un enregistrement de quelques minutes sous charge suffit à savoir si le problème existe chez vous, et d'où il vient.</p>

<div class="code">
  <div class="code-head"><span>Diagnostic</span><span>Shell</span></div>
<pre><span class="c"># Enregistrer 2 minutes sous charge</span>
jcmd &lt;pid&gt; JFR.start name=vt duration=2m filename=vt.jfr

<span class="c"># Lister les épinglages observés</span>
jfr summary vt.jfr
jfr print --events jdk.VirtualThreadPinned vt.jfr</pre>
</div>

<p>Chaque événement contient la trace d'appel responsable. C'est là que vous découvrirez que le coupable est un pilote JDBC, un client HTTP ou une bibliothèque de sérialisation — rarement votre propre code.</p>

<h2><span class="num">05 — La vraie surprise</span>Le goulot se déplace, il ne disparaît pas</h2>

<p>Voilà ce que personne ne dit dans les articles d'annonce. Vos deux cents threads limitaient le nombre de requêtes simultanées — et, par ricochet, protégeaient tout ce qui se trouvait derrière. En les supprimant, vous levez une digue.</p>

<p>Avec dix mille requêtes concurrentes, la question devient : combien de connexions à la base ? Votre pool HikariCP est probablement dimensionné à vingt. Les 9 980 autres threads virtuels attendent tous une connexion.</p>

<figure>
<svg viewBox="0 0 760 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Le goulot d'étranglement se déplace des threads vers le pool de connexions">
  <rect width="760" height="260" fill="#0D1524"/>
  <g stroke="#2A3A5C" stroke-width="1" opacity=".35">
    <path d="M0 40H760M0 80H760M0 120H760M0 160H760M0 200H760M0 240H760"/>
    <path d="M80 0V260M180 0V260M280 0V260M380 0V260M480 0V260M580 0V260M680 0V260"/>
  </g>

  <!-- entonnoir -->
  <text x="30" y="40" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#FFFFFF">AVANT</text>
  <rect x="110" y="52" width="120" height="44" rx="6" fill="#17223A" stroke="#3566E8" stroke-width="1.5"/>
  <text x="170" y="72" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#8FB2FF">200 threads</text>
  <text x="170" y="87" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#E23D4E">← goulot</text>

  <path d="M236 74H286" stroke="#4A5D80" stroke-width="2" marker-end="url(#g-arrow)"/>

  <rect x="292" y="52" width="120" height="44" rx="6" fill="#17223A" stroke="#3566E8" stroke-width="1.5"/>
  <text x="352" y="78" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#8FB2FF">pool DB : 20</text>

  <path d="M418 74H468" stroke="#4A5D80" stroke-width="2" marker-end="url(#g-arrow)"/>

  <rect x="474" y="52" width="120" height="44" rx="6" fill="#17223A" stroke="#3566E8" stroke-width="1.5"/>
  <text x="534" y="78" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#8FB2FF">base de données</text>
  <text x="620" y="78" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#8FE0B0">tout va bien</text>

  <!-- après -->
  <text x="30" y="160" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#FFFFFF">APRÈS</text>
  <rect x="110" y="152" width="120" height="44" rx="6" fill="#0F2419" stroke="#16A75C" stroke-width="1.5"/>
  <text x="170" y="172" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#8FE0B0">10 000 threads</text>
  <text x="170" y="187" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#8FA3C8">plus de limite</text>

  <path d="M236 174H286" stroke="#4A5D80" stroke-width="2" marker-end="url(#g-arrow)"/>

  <rect x="292" y="152" width="120" height="44" rx="6" fill="#1E1420" stroke="#E23D4E" stroke-width="2"/>
  <text x="352" y="172" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#F3A8B0">pool DB : 20</text>
  <text x="352" y="187" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#E23D4E">← nouveau goulot</text>

  <path d="M418 174H468" stroke="#4A5D80" stroke-width="2" marker-end="url(#g-arrow)"/>

  <rect x="474" y="152" width="120" height="44" rx="6" fill="#241C11" stroke="#EFA02B" stroke-width="1.5"/>
  <text x="534" y="178" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#F6C784">timeouts en série</text>

  <rect x="30" y="216" width="700" height="30" rx="8" fill="#17223A" stroke="#2A3A5C"/>
  <text x="380" y="236" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#C3D0E6">Supprimer une limite ne crée pas de capacité. Elle déplace la file d'attente.</text>

  <defs>
    <marker id="g-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9z" fill="#4A5D80"/></marker>
  </defs>
</svg>
<figcaption><b>Fig. 4</b> — Les threads n'étaient pas seulement une limite, ils étaient aussi une protection. En les libérant, vous devez rendre explicite ce qui était implicite.</figcaption>
</figure>

<p>Concrètement, il faut désormais poser des limites là où elles étaient offertes gratuitement : un sémaphore devant les appels vers un service fragile, un timeout d'acquisition de connexion qui échoue vite plutôt que d'empiler, et un Circuit Breaker sur chaque dépendance externe.</p>

<div class="code">
  <div class="code-head"><span>Limiter explicitement</span><span>Java 21</span></div>
<pre><span class="a">@Component</span>
<span class="k">public class</span> <span class="t">ClientTarification</span> {

    <span class="c">// 50 appels simultanés au maximum vers ce service</span>
    <span class="k">private final</span> <span class="t">Semaphore</span> limite = <span class="k">new</span> <span class="t">Semaphore</span>(50);

    <span class="k">public</span> <span class="t">Tarif</span> consulter(<span class="t">String</span> reference) <span class="k">throws</span> <span class="t">InterruptedException</span> {
        <span class="k">if</span> (!limite.tryAcquire(2, <span class="t">TimeUnit</span>.SECONDS)) {
            <span class="k">throw new</span> <span class="t">ServiceSatureException</span>(reference);
        }
        <span class="k">try</span> {
            <span class="k">return</span> client.get(reference);
        } <span class="k">finally</span> {
            limite.release();
        }
    }
}</pre>
</div>

<p>C'est exactement le rôle du <em>bulkhead</em> — et c'est là que les deux sujets se rejoignent : plus vos threads sont nombreux, plus il devient indispensable de protéger explicitement ce qu'ils appellent.</p>

<h2><span class="num">06 — Terrain</span>Cinq erreurs qui reviennent</h2>

<div class="pitfall">
  <div class="no">01</div>
  <div>
    <h4>Mettre les threads virtuels en pool</h4>
    <p>Réflexe hérité du modèle plateforme, et contresens complet. Un thread virtuel se crée par tâche et meurt avec elle. Le mettre en pool réintroduit la limite que vous veniez de lever.</p>
  </div>
</div>

<div class="pitfall">
  <div class="no">02</div>
  <div>
    <h4>Oublier de redimensionner le pool de connexions</h4>
    <p>Le premier symptôme après activation, ce sont les timeouts d'acquisition HikariCP. Redimensionner le pool aide, mais la vraie réponse est de limiter la concurrence en amont — votre base a, elle aussi, une capacité finie.</p>
  </div>
</div>

<div class="pitfall">
  <div class="no">03</div>
  <div>
    <h4>Traiter du calcul pur sur threads virtuels</h4>
    <p>Le démontage n'apporte rien à une tâche qui ne bloque jamais. Sur du calcul intensif, vous n'aurez aucun gain, et vous risquez de saturer les carriers. Pour ce cas, le pool de threads plateforme reste le bon outil.</p>
  </div>
</div>

<div class="pitfall">
  <div class="no">04</div>
  <div>
    <h4>Accumuler des ThreadLocal volumineux</h4>
    <p>Un <code>ThreadLocal</code> chargé était acceptable avec deux cents threads. Avec cinquante mille, la même donnée est dupliquée cinquante mille fois. Les <code>ScopedValue</code>, finalisés dans le JDK 25, répondent précisément à ce besoin.</p>
  </div>
</div>

<div class="pitfall">
  <div class="no">05</div>
  <div>
    <h4>Activer en production sans mesure préalable</h4>
    <p>Sans campagne de charge avant et après, vous ne saurez pas si le gain existe, ni où le nouveau goulot s'est formé. Un test de charge avec Gatling ou k6, et un enregistrement JFR pour le pinning : deux heures de travail qui évitent une soirée d'astreinte.</p>
  </div>
</div>

<h2><span class="num">07 — Arbitrage</span>Quand ça ne sert à rien</h2>

<p>Les threads virtuels ne sont pas une optimisation universelle. Trois cas où ils n'apporteront rien.</p>

<p><strong>Votre application est limitée par le CPU.</strong> Transformation de données, calcul, chiffrement : si vos threads travaillent au lieu d'attendre, le nombre de cœurs reste la seule limite qui compte.</p>

<p><strong>Vous êtes déjà en réactif.</strong> WebFlux résout le même problème par un autre chemin. Migrer une application réactive qui fonctionne vers des threads virtuels est un chantier sans bénéfice mesurable.</p>

<p><strong>Votre goulot est ailleurs.</strong> Si votre base sature à trente requêtes par seconde, vous pouvez créer un million de threads : vous ferez seulement patienter plus de monde. Mesurez avant de configurer.</p>

<div class="table-scroll">
<table>
  <thead><tr><th>Situation</th><th>Ce qu'il faut faire</th></tr></thead>
  <tbody>
    <tr><td>API qui appelle plusieurs services HTTP</td><td>Cas idéal. Activez, mesurez, ajoutez des sémaphores.</td></tr>
    <tr><td>Application CRUD classique sur une base</td><td>Gain réel mais limité par la base. Redimensionnez le pool avec prudence.</td></tr>
    <tr><td>Traitement par lots, calcul intensif</td><td>Gardez les threads plateforme.</td></tr>
    <tr><td>Application déjà en WebFlux</td><td>Ne migrez pas.</td></tr>
    <tr><td>Code truffé de <code>synchronized</code> sur JDK 21</td><td>Repérez le pinning par JFR avant d'activer, ou passez au JDK 24+.</td></tr>
  </tbody>
</table>
</div>

<h2><span class="num">08 — Récapitulatif</span>La fiche à garder sous la main</h2>

<div class="cheat">
  <h3>Threads virtuels — l'essentiel</h3>
  <p class="sub">Java 21+ · Spring Boot 3.2+</p>
  <div class="cheat-grid">
    <div class="cheat-card c-virtual">
      <div class="h">● ACTIVER</div>
      <ul>
        <li><code>spring.threads.virtual.enabled: true</code></li>
        <li><code>Thread.ofVirtual().start(...)</code></li>
        <li><code>Executors.newVirtualThreadPerTaskExecutor()</code></li>
      </ul>
    </div>
    <div class="cheat-card c-pinned">
      <div class="h">● PINNING</div>
      <ul>
        <li>Causes : <code>synchronized</code> (&lt; JDK 24), JNI, <code>Object.wait()</code></li>
        <li>Remède : <code>ReentrantLock</code></li>
        <li>Détection : JFR <code>jdk.VirtualThreadPinned</code></li>
      </ul>
    </div>
    <div class="cheat-card c-io">
      <div class="h">⚠ NOUVEAU GOULOT</div>
      <ul>
        <li>Pool HikariCP saturé</li>
        <li>Service tiers submergé</li>
        <li>Remède : <code>Semaphore</code> + Circuit Breaker</li>
      </ul>
    </div>
    <div class="cheat-card">
      <div class="h">✕ À NE PAS FAIRE</div>
      <ul>
        <li>Les mettre en pool</li>
        <li>Les utiliser pour du calcul pur</li>
        <li>Garder des <code>ThreadLocal</code> volumineux</li>
      </ul>
    </div>
    <div class="cheat-card">
      <div class="h">⚙ RÉGLAGES</div>
      <ul>
        <li><code>jdk.virtualThreadScheduler.parallelism</code></li>
        <li><code>jdk.virtualThreadScheduler.maxPoolSize</code></li>
        <li>Par défaut : nb de processeurs</li>
      </ul>
    </div>
    <div class="cheat-card">
      <div class="h">◉ MESURER</div>
      <ul>
        <li>Charge avant / après (Gatling, k6)</li>
        <li>JFR sous charge réelle</li>
        <li>Temps d'acquisition HikariCP</li>
      </ul>
    </div>
  </div>
</div>

<h2><span class="num">09 — Pour finir</span>Une ligne de configuration, une architecture à revoir</h2>

<p>Ce qui rend les threads virtuels remarquables, c'est le rapport entre l'effort et le résultat : une propriété, du code inchangé, et un plafond de concurrence qui saute. On comprend l'enthousiasme.</p>

<p>Mais ce plafond n'était pas qu'une gêne. Il tenait lieu de régulateur pour tout ce qui se trouvait en aval. En le retirant, vous héritez de la responsabilité de dire explicitement ce que votre application accepte de faire en parallèle — vers chaque base, chaque service, chaque dépendance.</p>

<p>Autrement dit : les threads virtuels ne suppriment pas la question du dimensionnement, ils vous obligent à y répondre pour de bon.</p>

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
    'https://charrad.dev/assets/images/articles/threads-virtuels-java21.png',
    'PUBLISHED',
    NOW(),
    u.id,
    NOW(),
    NOW()
FROM users u WHERE u.email = 'admin@portfolio.dev'
ON CONFLICT (slug) DO NOTHING;
