-- =============================================================================
-- V16__add_vraie_ip_cloudflare_article.sql — Publie l'article "Vraie IP client"
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
-- Contrairement à V15, aucune neutralisation de placeholder n'est nécessaire :
-- l'article ne contient aucune séquence dollar-accolade, qui est le préfixe des
-- placeholders de Flyway et que celui-ci substitue y compris À L'INTÉRIEUR d'un
-- dollar-quoting. Les seuls dollars du HTML sont des variables shell et nginx
-- isolées (remote_addr, TMP, host), que Flyway laisse intactes. Vérifié par
-- recherche sur le fichier, puis les 16 migrations ont été rejouées avec le
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
    'Derrière Cloudflare, tous vos visiteurs ont la même IP',
    'vraie-ip-client-cloudflare',
    'Vos journaux ne montrent plus que l''adresse du proxy. Restaurer la vraie IP du client prend cinq lignes de configuration — et se transforme en faille d''usurpation si vous vous arrêtez là.',
    $article$
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Derrière Cloudflare, tous vos visiteurs ont la même IP</title>
<meta name="description" content="Restaurer la véritable adresse IP du client derrière Cloudflare et nginx, dans une application Spring Boot — sans ouvrir une faille d'usurpation. Chaîne de confiance, real_ip, X-Forwarded-For et pare-feu d'origine.">
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

  /* Langage visuel : confiance et usurpation */
  --trusted:#16A75C;      /* maillon de confiance */
  --trusted-soft:#E4F6EC;
  --proxy:#3566E8;        /* intermédiaire */
  --proxy-soft:#E7EDFD;
  --spoof:#E23D4E;        /* usurpation */
  --spoof-soft:#FCE8EA;
  --header:#EFA02B;       /* en-tête HTTP */
  --header-soft:#FDF1DD;

  --volt:#3566E8;
  --volt-soft:#E7EDFD;

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
.hero h1{font-family:var(--display);font-weight:700;font-size:clamp(34px,6vw,54px);line-height:1.08;letter-spacing:-.02em;margin:0 0 20px}
.hero h1 em{font-style:normal;color:var(--spoof)}
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
.k{color:#7FA9FF}.s{color:#8DE0A6}.c{color:#6B7FA3;font-style:italic}.a{color:#F2C46B}.t{color:#6FD2E2}.r{color:#F3A8B0}

.note{border-left:4px solid var(--volt);background:var(--volt-soft);padding:16px 20px;border-radius:0 8px 8px 0;margin:26px 0;font-size:17.5px}
.note .lbl{font-family:var(--mono);font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--volt);display:block;margin-bottom:6px;font-weight:700}
.note p:last-child{margin-bottom:0}
.note.warn{border-color:var(--spoof);background:var(--spoof-soft)}
.note.warn .lbl{color:var(--spoof)}
.note.good{border-color:var(--trusted);background:var(--trusted-soft)}
.note.good .lbl{color:var(--trusted)}

.table-scroll{overflow-x:auto;margin:26px 0;border:1px solid var(--rule);border-radius:10px}
table{border-collapse:collapse;width:100%;font-size:15.5px;min-width:600px}
th{background:var(--wash);font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;text-align:left;padding:12px 16px;color:var(--muted);font-weight:700;border-bottom:1px solid var(--rule)}
td{padding:13px 16px;border-bottom:1px solid var(--rule);vertical-align:top;line-height:1.5}
tr:last-child td{border-bottom:0}
td:first-child{width:32%}

.pitfall{display:grid;grid-template-columns:44px 1fr;gap:16px;padding:20px 0;border-bottom:1px solid var(--rule)}
.pitfall:last-of-type{border-bottom:0}
.pitfall .no{font-family:var(--mono);font-size:15px;font-weight:700;color:var(--spoof);background:var(--spoof-soft);border-radius:8px;height:36px;display:grid;place-items:center}
.pitfall h4{font-family:var(--display);font-size:18px;font-weight:600;margin:4px 0 6px}
.pitfall p{margin:0;font-size:17px}

.cheat{background:var(--ink);border-radius:14px;padding:32px;margin:44px 0;color:#fff}
.cheat h3{color:#fff;margin:0 0 4px;font-size:24px}
.cheat .sub{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#7E93BC;margin:0 0 26px}
.cheat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
.cheat-card{background:var(--ink-soft);border-radius:10px;padding:16px 18px;border-top:3px solid var(--volt)}
.cheat-card.c-trusted{border-color:var(--trusted)}
.cheat-card.c-spoof{border-color:var(--spoof)}
.cheat-card.c-header{border-color:var(--header)}
.cheat-card .h{font-family:var(--mono);font-size:12.5px;font-weight:700;letter-spacing:.06em;margin-bottom:8px}
.c-trusted .h{color:var(--trusted)}
.c-spoof .h{color:var(--spoof)}
.c-header .h{color:var(--header)}
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
</style>
</head>
<body>

<header class="hero">
  <div class="wrap">
    <p class="eyebrow">Cloudflare · nginx · Spring Boot · Sécurité</p>
    <h1>Derrière Cloudflare, tous vos visiteurs ont la <em>même IP</em></h1>
    <p class="standfirst">Vos journaux ne montrent plus que l'adresse du proxy. Restaurer la vraie IP du client prend cinq lignes de configuration — et se transforme en faille d'usurpation si vous vous arrêtez là.</p>
    <div class="byline">
      <span>Par <b>Amine Charrad</b></span>
      <span>·</span>
      <span>13 min de lecture</span>
      <span>·</span>
      <span>nginx · Spring Boot 3 · AWS</span>
    </div>
  </div>
</header>

<div class="states-strip">
  <div class="wrap">
    <div class="state-chip">
      <div class="nm"><span class="dot" style="background:#16A75C"></span>IP RÉELLE</div>
      <div class="ds">Celle du visiteur. Nécessaire aux quotas, aux bans, aux journaux.</div>
    </div>
    <div class="state-chip">
      <div class="nm"><span class="dot" style="background:#3566E8"></span>PROXY DE CONFIANCE</div>
      <div class="ds">Un intermédiaire dont vous connaissez l'adresse et que vous contrôlez.</div>
    </div>
    <div class="state-chip">
      <div class="nm"><span class="dot" style="background:#E23D4E"></span>EN-TÊTE FALSIFIÉ</div>
      <div class="ds">Deux secondes à fabriquer. Un client peut écrire n'importe quelle IP.</div>
    </div>
  </div>
</div>

<main>
<div class="wrap">

<p>Vous placez votre application derrière Cloudflare. Le certificat est géré, le cache fonctionne, la protection anti-DDoS est active. Puis vous ouvrez les journaux d'accès.</p>

<div class="code">
  <div class="code-head"><span>access.log</span><span>nginx</span></div>
<pre>172.71.98.14 - - [12/Aug/2026:09:14:22] "GET /api/projects" 200
172.71.98.14 - - [12/Aug/2026:09:14:23] "POST /auth/login" 401
172.71.98.14 - - [12/Aug/2026:09:14:23] "POST /auth/login" 401
172.71.98.14 - - [12/Aug/2026:09:14:24] "POST /auth/login" 401
172.71.98.14 - - [12/Aug/2026:09:14:24] "POST /auth/login" 401</pre>
</div>

<p>Une seule adresse, pour tout le monde. C'est celle du nœud Cloudflare qui vous transmet le trafic, et elle est identique pour votre visiteur légitime et pour celui qui teste mille mots de passe sur votre page de connexion.</p>

<p>Ce n'est pas un détail cosmétique. Tout ce qui repose sur l'identité réseau du client vient de tomber : la limitation de débit compte toutes les requêtes du monde dans le même seau, un bannissement par IP bloque l'ensemble de vos visiteurs, la géolocalisation renvoie le centre de données du proxy, et l'analyse post-incident devient impossible.</p>

<h2><span class="num">01 — La chaîne</span>Ce que voit chaque maillon</h2>

<p>Une requête traverse maintenant plusieurs machines, et chacune ne connaît que celle qui la précède immédiatement. Le protocole TCP ne transporte pas d'historique : à chaque saut, l'adresse source est celle du saut précédent.</p>

<figure>
<svg viewBox="0 0 760 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Chaîne client, Cloudflare, nginx, Spring Boot et ce que chaque maillon voit comme adresse source">
  <rect width="760" height="320" fill="#0D1524"/>
  <g stroke="#2A3A5C" stroke-width="1" opacity=".35">
    <path d="M0 40H760M0 80H760M0 120H760M0 160H760M0 200H760M0 240H760M0 280H760"/>
    <path d="M60 0V320M160 0V320M260 0V320M360 0V320M460 0V320M560 0V320M660 0V320"/>
  </g>

  <!-- maillons -->
  <rect x="24" y="70" width="150" height="70" rx="10" fill="#0F2419" stroke="#16A75C" stroke-width="2.5"/>
  <text x="99" y="98" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#8FE0B0">CLIENT</text>
  <text x="99" y="118" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#C3D0E6">88.120.4.51</text>

  <rect x="212" y="70" width="150" height="70" rx="10" fill="#17223A" stroke="#3566E8" stroke-width="2"/>
  <text x="287" y="98" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#8FB2FF">CLOUDFLARE</text>
  <text x="287" y="118" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#C3D0E6">172.71.98.14</text>

  <rect x="400" y="70" width="150" height="70" rx="10" fill="#17223A" stroke="#3566E8" stroke-width="2"/>
  <text x="475" y="98" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#8FB2FF">NGINX</text>
  <text x="475" y="118" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#C3D0E6">172.18.0.2</text>

  <rect x="588" y="70" width="150" height="70" rx="10" fill="#1E1420" stroke="#E23D4E" stroke-width="2"/>
  <text x="663" y="98" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#F3A8B0">SPRING BOOT</text>
  <text x="663" y="118" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#F3A8B0">voit 172.18.0.2</text>

  <path d="M178 105H208" stroke="#4A5D80" stroke-width="2" marker-end="url(#ch-arrow)"/>
  <path d="M366 105H396" stroke="#4A5D80" stroke-width="2" marker-end="url(#ch-arrow)"/>
  <path d="M554 105H584" stroke="#4A5D80" stroke-width="2" marker-end="url(#ch-arrow)"/>

  <!-- ce que chacun ajoute -->
  <text x="24" y="180" font-family="JetBrains Mono, monospace" font-size="11.5" letter-spacing="1.2" fill="#7E93BC">EN-TÊTES AJOUTÉS AU PASSAGE</text>

  <rect x="212" y="196" width="326" height="30" rx="6" fill="#241C11" stroke="#EFA02B" stroke-width="1.5"/>
  <text x="228" y="216" font-family="JetBrains Mono, monospace" font-size="11" fill="#F6C784">CF-Connecting-IP: 88.120.4.51</text>

  <rect x="212" y="234" width="450" height="30" rx="6" fill="#241C11" stroke="#EFA02B" stroke-width="1.5"/>
  <text x="228" y="254" font-family="JetBrains Mono, monospace" font-size="11" fill="#F6C784">X-Forwarded-For: 88.120.4.51, 172.71.98.14</text>

  <rect x="24" y="278" width="714" height="30" rx="8" fill="#17223A" stroke="#2A3A5C"/>
  <text x="381" y="298" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#C3D0E6">L'adresse d'origine ne survit que dans un en-tête HTTP. Rien ne l'authentifie.</text>

  <defs>
    <marker id="ch-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9z" fill="#4A5D80"/></marker>
  </defs>
</svg>
<figcaption><b>Fig. 1</b> — Spring Boot ne peut pas connaître l'IP d'origine : sa connexion TCP vient de nginx. L'information existe seulement dans les en-têtes ajoutés par les proxies.</figcaption>
</figure>

<h3>Les en-têtes en présence</h3>

<div class="table-scroll">
<table>
  <thead><tr><th>En-tête</th><th>Contenu et fiabilité</th></tr></thead>
  <tbody>
    <tr><td><code>X-Forwarded-For</code></td><td>Liste d'adresses séparées par des virgules, la plus ancienne en premier. Chaque proxy ajoute la sienne à la fin. Standard de fait, falsifiable.</td></tr>
    <tr><td><code>CF-Connecting-IP</code></td><td>Ajouté par Cloudflare : une seule adresse, celle du visiteur. Cloudflare écrase toute valeur préexistante.</td></tr>
    <tr><td><code>X-Real-IP</code></td><td>Convention nginx, une seule adresse. Sa signification dépend entièrement de qui l'a posée.</td></tr>
    <tr><td><code>Forwarded</code></td><td>Le standard officiel (RFC 7239), avec une syntaxe <code>for=</code>, <code>proto=</code>, <code>by=</code>. Correct, mais peu déployé.</td></tr>
  </tbody>
</table>
</div>

<div class="note warn">
  <span class="lbl">Le point à ne jamais oublier</span>
  <p>Aucun de ces en-têtes n'est authentifié. Ce sont des chaînes de caractères qu'un client peut écrire lui-même. Leur valeur ne vaut que par la confiance que vous accordez à la machine qui les a posées — et cette confiance, c'est à vous de la configurer.</p>
</div>

<h2><span class="num">02 — La faille</span>Faire confiance à un en-tête, c'est ouvrir la porte</h2>

<p>Voici la configuration que l'on trouve dans la moitié des réponses sur les forums. Elle « marche » : votre vraie IP apparaît dans les journaux.</p>

<div class="code">
  <div class="code-head"><span>À ne surtout pas faire</span><span>Java</span></div>
<pre><span class="c">// ✕ On prend le premier élément de X-Forwarded-For, sans rien vérifier</span>
<span class="k">public</span> <span class="t">String</span> ipClient(<span class="t">HttpServletRequest</span> requete) {
    <span class="t">String</span> xff = requete.getHeader(<span class="s">"X-Forwarded-For"</span>);
    <span class="k">if</span> (xff != <span class="k">null</span>) {
        <span class="k">return</span> xff.split(<span class="s">","</span>)[<span class="s">0</span>].trim();
    }
    <span class="k">return</span> requete.getRemoteAddr();
}</pre>
</div>

<p>Le problème, c'est que n'importe qui peut envoyer cet en-tête. Une commande suffit :</p>

<div class="code">
  <div class="code-head"><span>Usurpation</span><span>Shell</span></div>
<pre>curl https://exemple.fr/auth/login \
  -H <span class="s">"X-Forwarded-For: 1.2.3.4"</span> \
  -d <span class="s">'{"email":"admin@exemple.fr","password":"..."}'</span></pre>
</div>

<p>Votre application enregistre <code>1.2.3.4</code>. L'attaquant change la valeur à chaque requête et dispose d'un nombre illimité d'identités. Concrètement, votre limitation de débit ne limite plus rien, vos bannissements ne bannissent personne, et si une adresse figure dans une liste d'autorisation — un back-office restreint, un endpoint d'administration — elle vient d'être contournée.</p>

<figure>
<svg viewBox="0 0 760 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Lecture de X-Forwarded-For depuis la droite en s'arrêtant au premier proxy non fiable">
  <rect width="760" height="300" fill="#0D1524"/>
  <g stroke="#2A3A5C" stroke-width="1" opacity=".35">
    <path d="M0 50H760M0 100H760M0 150H760M0 200H760M0 250H760"/>
    <path d="M60 0V300M160 0V300M260 0V300M360 0V300M460 0V300M560 0V300M660 0V300"/>
  </g>

  <text x="24" y="40" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#FFFFFF">X-Forwarded-For reçu par nginx</text>

  <!-- la liste -->
  <rect x="24" y="58" width="200" height="46" rx="8" fill="#1E1420" stroke="#E23D4E" stroke-width="2"/>
  <text x="124" y="80" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" fill="#F3A8B0">1.2.3.4</text>
  <text x="124" y="96" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#E23D4E">écrit par le client</text>

  <rect x="240" y="58" width="200" height="46" rx="8" fill="#0F2419" stroke="#16A75C" stroke-width="2.5"/>
  <text x="340" y="80" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" fill="#8FE0B0">88.120.4.51</text>
  <text x="340" y="96" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#8FA3C8">posé par Cloudflare</text>

  <rect x="456" y="58" width="200" height="46" rx="8" fill="#17223A" stroke="#3566E8" stroke-width="2"/>
  <text x="556" y="80" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" fill="#8FB2FF">172.71.98.14</text>
  <text x="556" y="96" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#8FA3C8">nœud Cloudflare</text>

  <!-- zone de confiance -->
  <rect x="448" y="46" width="216" height="70" rx="10" fill="none" stroke="#3566E8" stroke-width="2" stroke-dasharray="7 5"/>
  <text x="556" y="134" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#8FB2FF">zone de confiance</text>

  <!-- sens de lecture -->
  <path d="M660 168H350" stroke="#EFA02B" stroke-width="2.5" marker-end="url(#x-arrow)"/>
  <text x="505" y="160" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#F6C784">on lit depuis la DROITE</text>

  <rect x="240" y="184" width="200" height="34" rx="8" fill="#0F2419" stroke="#16A75C" stroke-width="2.5"/>
  <text x="340" y="206" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#8FE0B0">on s'arrête ici</text>

  <text x="24" y="206" font-family="JetBrains Mono, monospace" font-size="11" fill="#E23D4E">ignoré</text>

  <rect x="24" y="240" width="712" height="46" rx="8" fill="#17223A" stroke="#2A3A5C"/>
  <text x="380" y="262" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#C3D0E6">On parcourt la liste de droite à gauche en sautant les proxies connus.</text>
  <text x="380" y="278" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#8FE0B0">La première adresse non fiable rencontrée est la vraie IP du client.</text>

  <defs>
    <marker id="x-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9z" fill="#EFA02B"/></marker>
  </defs>
</svg>
<figcaption><b>Fig. 2</b> — La partie gauche de la liste vient du client et ne vaut rien. Seule la portion posée par des machines dont vous connaissez l'adresse est exploitable.</figcaption>
</figure>

<div class="note good">
  <span class="lbl">Le principe, en une phrase</span>
  <p>Ne faites jamais confiance à un en-tête, faites confiance à une <em>adresse source</em>. La question n'est pas « que dit <code>X-Forwarded-For</code> » mais « la machine qui m'a envoyé cette requête est-elle un proxy que je connais ». Tant que la réponse est oui, on continue à remonter la liste. Dès qu'elle est non, on s'arrête : on a trouvé le client.</p>
</div>

<h2><span class="num">03 — nginx</span>Restaurer l'adresse au bon endroit</h2>

<p>La bonne nouvelle, c'est que vous n'avez presque rien à écrire vous-même. Le module <code>ngx_http_realip_module</code> — présent dans les paquets et images officiels — implémente exactement cette logique, et il réécrit <code>$remote_addr</code> pour tout ce qui suit : journaux, limitation de débit, variables transmises en amont.</p>

<div class="code">
  <div class="code-head"><span>/etc/nginx/conf.d/cloudflare.conf</span><span>nginx</span></div>
<pre><span class="c"># Plages IPv4 de Cloudflare (extrait — la liste réelle en compte une quinzaine)</span>
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;

<span class="c"># Plages IPv6</span>
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;

<span class="c"># On lit l'en-tête posé par Cloudflare, qui contient une seule adresse</span>
real_ip_header CF-Connecting-IP;</pre>
</div>

<p>Deux points méritent d'être compris plutôt que copiés.</p>

<p><strong>Pourquoi <code>CF-Connecting-IP</code> plutôt que <code>X-Forwarded-For</code>.</strong> Cloudflare écrase systématiquement cet en-tête avec l'adresse du visiteur, alors qu'il se contente d'ajouter à la fin de <code>X-Forwarded-For</code> — en conservant ce que le client y avait mis. Un seul champ, une seule valeur, aucune ambiguïté.</p>

<p><strong>Pourquoi <code>real_ip_recursive</code> n'apparaît pas.</strong> Cette directive sert à remonter une liste en sautant les proxies connus. Avec <code>CF-Connecting-IP</code>, il n'y a pas de liste : une seule adresse. La directive n'a donc aucun effet ici. Elle devient indispensable si vous utilisez <code>X-Forwarded-For</code>, et son absence est alors une erreur classique.</p>

<div class="code">
  <div class="code-head"><span>Variante avec X-Forwarded-For</span><span>nginx</span></div>
<pre>real_ip_header X-Forwarded-For;
real_ip_recursive on;   <span class="c"># obligatoire : remonte la liste en sautant les proxies connus</span></pre>
</div>

<h3>Tenir les plages à jour</h3>

<p>Cloudflare fait évoluer ses plages. Une liste figée finit par contenir une plage retirée — ou, plus gênant, par ne pas contenir une plage ajoutée, ce qui fait réapparaître des IP de proxy dans vos journaux. Automatisez.</p>

<div class="code">
  <div class="code-head"><span>/opt/scripts/maj-cloudflare-ips.sh</span><span>Shell</span></div>
<pre><span class="c">#!/usr/bin/env bash</span>
<span class="k">set</span> -euo pipefail

CONF=/etc/nginx/conf.d/cloudflare.conf
TMP=$(mktemp)

{
  <span class="k">for</span> url <span class="k">in</span> https://www.cloudflare.com/ips-v4 https://www.cloudflare.com/ips-v6; <span class="k">do</span>
    curl -fsS --max-time 10 <span class="s">"$url"</span> | <span class="k">while read</span> -r plage; <span class="k">do</span>
      [ -n <span class="s">"$plage"</span> ] &amp;&amp; <span class="k">echo</span> <span class="s">"set_real_ip_from $plage;"</span>
    <span class="k">done</span>
  <span class="k">done</span>
  <span class="k">echo</span> <span class="s">"real_ip_header CF-Connecting-IP;"</span>
} &gt; <span class="s">"$TMP"</span>

<span class="c"># Garde-fou : un fichier trop court signale un échec de récupération</span>
<span class="k">if</span> [ "$(wc -l &lt; <span class="s">"$TMP"</span>)" -lt <span class="s">15</span> ]; <span class="k">then</span>
  <span class="k">echo</span> <span class="s">"Liste suspecte, abandon"</span> &gt;&amp;2
  exit 1
<span class="k">fi</span>

install -m 644 <span class="s">"$TMP"</span> <span class="s">"$CONF"</span>
nginx -t &amp;&amp; systemctl reload nginx</pre>
</div>

<p>Le <code>nginx -t</code> avant le rechargement n'est pas une politesse : sans lui, un fichier malformé récupéré un mauvais jour empêche nginx de redémarrer. Et le contrôle sur le nombre de lignes vous protège du cas où <code>curl</code> renvoie une page d'erreur au lieu de la liste.</p>

<p>Un timer systemd hebdomadaire suffit largement.</p>

<div class="code">
  <div class="code-head"><span>/etc/systemd/system/cloudflare-ips.timer</span><span>systemd</span></div>
<pre><span class="a">[Unit]</span>
Description=Mise à jour des plages IP Cloudflare

<span class="a">[Timer]</span>
OnCalendar=weekly
Persistent=true
RandomizedDelaySec=1h

<span class="a">[Install]</span>
WantedBy=timers.target</pre>
</div>

<h2><span class="num">04 — Spring Boot</span>Faire suivre l'information jusqu'à l'application</h2>

<p>nginx a rétabli la bonne adresse chez lui, mais Spring Boot voit toujours la connexion venir de nginx. Il faut lui dire de lire les en-têtes transmis — et de ne le faire que pour nginx.</p>

<div class="code">
  <div class="code-head"><span>nginx — bloc de proxy</span><span>nginx</span></div>
<pre>location / {
    proxy_pass http://backend:8080;

    <span class="c"># $remote_addr contient déjà la vraie IP grâce à real_ip</span>
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP       $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host  $host;
    proxy_set_header Host              $host;
}</pre>
</div>

<div class="code">
  <div class="code-head"><span>application.yml</span><span>Spring Boot 3</span></div>
<pre><span class="a">server</span>:
  <span class="a">forward-headers-strategy</span>: NATIVE
  <span class="a">tomcat</span>:
    <span class="a">remoteip</span>:
      <span class="a">remote-ip-header</span>: x-forwarded-for
      <span class="a">protocol-header</span>: x-forwarded-proto
      <span class="c"># Adresses considérées comme proxies internes : ici le réseau Docker</span>
      <span class="a">internal-proxies</span>: <span class="s">"172\\.1[6-9]\\.\\d{1,3}\\.\\d{1,3}|172\\.2[0-9]\\.\\d{1,3}\\.\\d{1,3}|172\\.3[0-1]\\.\\d{1,3}\\.\\d{1,3}|127\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}"</span></pre>
</div>

<p>La stratégie <code>NATIVE</code> délègue à la <code>RemoteIpValve</code> de Tomcat, qui applique exactement l'algorithme de la figure 2 : lecture depuis la droite, en sautant tout ce qui correspond à <code>internal-proxies</code>. La stratégie <code>FRAMEWORK</code> fait le même travail via un filtre Spring — utile si vous n'êtes pas sur Tomcat.</p>

<p>À partir de là, <code>request.getRemoteAddr()</code> renvoie la vraie adresse, sans aucun code spécifique. Et surtout : tout ce qui repose dessus fonctionne de nouveau, y compris les briques que vous n'avez pas écrites.</p>

<div class="code">
  <div class="code-head"><span>Limitation de débit</span><span>Java 21</span></div>
<pre><span class="a">@Component</span>
<span class="k">public class</span> <span class="t">LimiteurConnexion</span> <span class="k">implements</span> <span class="t">HandlerInterceptor</span> {

    <span class="k">private final</span> <span class="t">Map</span>&lt;<span class="t">String</span>, <span class="t">Bucket</span>&gt; seaux = <span class="k">new</span> <span class="t">ConcurrentHashMap</span>&lt;&gt;();

    <span class="a">@Override</span>
    <span class="k">public boolean</span> preHandle(<span class="t">HttpServletRequest</span> req, <span class="t">HttpServletResponse</span> res, <span class="t">Object</span> h) {
        <span class="c">// getRemoteAddr() renvoie maintenant la vraie IP du visiteur</span>
        <span class="t">Bucket</span> seau = seaux.computeIfAbsent(req.getRemoteAddr(), ip -&gt;
            <span class="t">Bucket</span>.builder()
                  .addLimit(<span class="t">Bandwidth</span>.builder()
                      .capacity(<span class="s">5</span>)
                      .refillIntervally(<span class="s">5</span>, <span class="t">Duration</span>.ofMinutes(<span class="s">1</span>))
                      .build())
                  .build());

        <span class="k">if</span> (seau.tryConsume(<span class="s">1</span>)) <span class="k">return true</span>;

        res.setStatus(<span class="t">HttpStatus</span>.TOO_MANY_REQUESTS.value());
        <span class="k">return false</span>;
    }
}</pre>
</div>

<h2><span class="num">05 — Le maillon oublié</span>Verrouiller l'origine</h2>

<p>Voici le point que la plupart des tutoriels omettent, et il vide de sens tout ce qui précède.</p>

<p>Votre serveur possède une adresse IP publique. Cloudflare masque le nom de domaine, pas la machine. Si cette adresse reste joignable directement — et elle se retrouve facilement, via l'historique DNS, les journaux de certificats ou un sous-domaine mal configuré — alors un attaquant contourne complètement Cloudflare.</p>

<p>Et à ce moment-là, votre configuration <code>real_ip</code> se retourne contre vous : nginx fait confiance à <code>CF-Connecting-IP</code>, et l'attaquant le pose lui-même.</p>

<div class="code">
  <div class="code-head"><span>Contournement</span><span>Shell</span></div>
<pre><span class="c"># En tapant directement l'IP d'origine, sans passer par Cloudflare</span>
curl https://13.39.132.25/auth/login \
  -H <span class="s">"Host: exemple.fr"</span> \
  -H <span class="s">"CF-Connecting-IP: 9.9.9.9"</span></pre>
</div>

<p>La règle est simple : <strong>le serveur d'origine ne doit accepter du trafic que depuis les plages Cloudflare.</strong> Sur AWS, cela se fait au niveau du groupe de sécurité.</p>

<div class="code">
  <div class="code-head"><span>security-group.tf</span><span>Terraform</span></div>
<pre><span class="k">data</span> <span class="s">"http"</span> <span class="s">"cloudflare_ipv4"</span> {
  url = <span class="s">"https://www.cloudflare.com/ips-v4"</span>
}

<span class="k">resource</span> <span class="s">"aws_security_group_rule"</span> <span class="s">"https_cloudflare"</span> {
  type              = <span class="s">"ingress"</span>
  from_port         = <span class="s">443</span>
  to_port           = <span class="s">443</span>
  protocol          = <span class="s">"tcp"</span>
  security_group_id = aws_security_group.web.id

  <span class="c"># Seules les plages Cloudflare peuvent atteindre le port 443</span>
  cidr_blocks = compact(split(<span class="s">"\n"</span>, data.http.cloudflare_ipv4.response_body))
}</pre>
</div>

<p>En complément, Cloudflare propose l'<em>Authenticated Origin Pull</em> : un certificat client présenté par Cloudflare et vérifié par nginx. Le filtrage par IP couvre déjà l'essentiel du besoin ; le certificat client ferme le cas où une plage Cloudflare serait utilisée par un autre client de la plateforme.</p>

<div class="note warn">
  <span class="lbl">L'ordre des opérations compte</span>
  <p>Verrouillez l'origine <em>avant</em> de configurer <code>real_ip</code>. Dans l'autre sens, vous ouvrez une fenêtre pendant laquelle votre application fait confiance à un en-tête que le monde entier peut écrire.</p>
</div>

<h2><span class="num">06 — Vérifier</span>Prouver que ça marche, et que la faille est fermée</h2>

<p>Deux tests suffisent, et le second est le plus important.</p>

<div class="code">
  <div class="code-head"><span>Vérification</span><span>Shell</span></div>
<pre><span class="c"># 1. Par le domaine : l'IP doit être la vôtre</span>
curl -s https://exemple.fr/api/debug/ip
<span class="c"># → {"ip":"88.120.4.51"}   ✓</span>

<span class="c"># 2. Par le domaine, en tentant l'usurpation : la valeur doit être IGNORÉE</span>
curl -s https://exemple.fr/api/debug/ip -H <span class="s">"X-Forwarded-For: 1.2.3.4"</span>
<span class="c"># → {"ip":"88.120.4.51"}   ✓ Cloudflare écrase CF-Connecting-IP</span>

<span class="c"># 3. En direct sur l'origine : la connexion doit échouer</span>
curl -s --max-time 5 https://13.39.132.25/api/debug/ip -H <span class="s">"Host: exemple.fr"</span>
<span class="c"># → timeout   ✓ le groupe de sécurité fait son travail</span></pre>
</div>

<p>Un point de contrôle temporaire suffit pour la durée de la vérification :</p>

<div class="code">
  <div class="code-head"><span>DebugController.java</span><span>Java 21</span></div>
<pre><span class="a">@RestController</span>
<span class="a">@Profile</span>(<span class="s">"!prod"</span>)   <span class="c">// jamais exposé en production</span>
<span class="k">public class</span> <span class="t">DebugController</span> {

    <span class="a">@GetMapping</span>(<span class="s">"/api/debug/ip"</span>)
    <span class="k">public</span> <span class="t">Map</span>&lt;<span class="t">String</span>, <span class="t">String</span>&gt; ip(<span class="t">HttpServletRequest</span> req) {
        <span class="k">return</span> <span class="t">Map</span>.of(
            <span class="s">"ip"</span>, req.getRemoteAddr(),
            <span class="s">"xff"</span>, <span class="t">String</span>.valueOf(req.getHeader(<span class="s">"X-Forwarded-For"</span>)),
            <span class="s">"cf"</span>, <span class="t">String</span>.valueOf(req.getHeader(<span class="s">"CF-Connecting-IP"</span>))
        );
    }
}</pre>
</div>

<h2><span class="num">07 — Terrain</span>Six erreurs qui reviennent</h2>

<div class="pitfall">
  <div class="no">01</div>
  <div>
    <h4>Configurer real_ip sans verrouiller l'origine</h4>
    <p>La plus grave, parce qu'elle transforme une correction en vulnérabilité. Tant que votre IP publique répond à tout le monde, faire confiance à un en-tête revient à laisser chacun choisir son identité.</p>
  </div>
</div>

<div class="pitfall">
  <div class="no">02</div>
  <div>
    <h4>Prendre le premier élément de X-Forwarded-For</h4>
    <p>C'est la partie de la liste que le client contrôle. La vraie IP se trouve en partant de la droite, après avoir sauté les proxies connus.</p>
  </div>
</div>

<div class="pitfall">
  <div class="no">03</div>
  <div>
    <h4>Oublier <code>real_ip_recursive</code> avec X-Forwarded-For</h4>
    <p>Sans cette directive, nginx ne remonte pas la liste et retient l'adresse du dernier proxy. La configuration semble appliquée, les journaux montrent toujours une IP de proxy, et on cherche longtemps.</p>
  </div>
</div>

<div class="pitfall">
  <div class="no">04</div>
  <div>
    <h4>Figer les plages Cloudflare</h4>
    <p>Elles évoluent. Une plage ajoutée et absente de votre configuration réintroduit silencieusement des IP de proxy dans vos journaux et vos quotas. Un timer hebdomadaire règle le sujet définitivement.</p>
  </div>
</div>

<div class="pitfall">
  <div class="no">05</div>
  <div>
    <h4>Ne pas compter les sauts intermédiaires</h4>
    <p>Un équilibreur de charge AWS, un maillage de services ou un conteneur supplémentaire ajoutent chacun leur entrée dans la liste. Si votre configuration ignore un saut, vous lisez l'adresse d'un composant interne au lieu de celle du visiteur.</p>
  </div>
</div>

<div class="pitfall">
  <div class="no">06</div>
  <div>
    <h4>Laisser le point de débogage en production</h4>
    <p>Un endpoint qui renvoie les en-têtes bruts renseigne un attaquant sur votre topologie et sur ce que vous filtrez. Le <code>@Profile("!prod")</code> n'est pas décoratif.</p>
  </div>
</div>

<h2><span class="num">08 — Récapitulatif</span>La fiche à garder sous la main</h2>

<div class="cheat">
  <h3>Vraie IP client — l'essentiel</h3>
  <p class="sub">Cloudflare · nginx · Spring Boot</p>
  <div class="cheat-grid">
    <div class="cheat-card c-trusted">
      <div class="h">● NGINX</div>
      <ul>
        <li><code>set_real_ip_from</code> = plages Cloudflare</li>
        <li><code>real_ip_header CF-Connecting-IP</code></li>
        <li><code>real_ip_recursive on</code> si XFF</li>
      </ul>
    </div>
    <div class="cheat-card">
      <div class="h">⚙ SPRING BOOT</div>
      <ul>
        <li><code>server.forward-headers-strategy: NATIVE</code></li>
        <li><code>server.tomcat.remoteip.internal-proxies</code></li>
        <li><code>getRemoteAddr()</code> suffit ensuite</li>
      </ul>
    </div>
    <div class="cheat-card c-spoof">
      <div class="h">⚠ SANS ÇA, RIEN NE TIENT</div>
      <ul>
        <li>Origine filtrée aux plages Cloudflare</li>
        <li>Groupe de sécurité ou pare-feu</li>
        <li>Authenticated Origin Pull en renfort</li>
      </ul>
    </div>
    <div class="cheat-card c-header">
      <div class="h">◈ EN-TÊTES</div>
      <ul>
        <li><code>CF-Connecting-IP</code> : écrasé par Cloudflare</li>
        <li><code>X-Forwarded-For</code> : liste, lire à droite</li>
        <li><code>Forwarded</code> : RFC 7239</li>
      </ul>
    </div>
    <div class="cheat-card">
      <div class="h">✕ À NE PAS FAIRE</div>
      <ul>
        <li>Lire <code>split(",")[0]</code></li>
        <li>Figer les plages IP</li>
        <li>Exposer un endpoint de débogage</li>
      </ul>
    </div>
    <div class="cheat-card">
      <div class="h">◉ VÉRIFIER</div>
      <ul>
        <li>Par le domaine : vraie IP</li>
        <li>Avec faux <code>X-Forwarded-For</code> : ignoré</li>
        <li>En direct sur l'origine : timeout</li>
      </ul>
    </div>
  </div>
</div>

<h2><span class="num">09 — Pour finir</span>Une configuration, deux propriétés</h2>

<p>Ce sujet ressemble à un problème de journalisation. C'en est un — mais c'est aussi, et surtout, une question de frontière de confiance.</p>

<p>Tant que votre origine n'accepte que Cloudflare, l'en-tête <code>CF-Connecting-IP</code> est une information fiable et vous pouvez construire dessus : quotas, bannissements, géolocalisation, analyse d'incident. Dès que cette condition tombe, le même en-tête devient une déclaration d'identité librement modifiable, et chaque mécanisme qui s'appuie dessus se retourne.</p>

<p>Les deux moitiés ne se séparent pas. Restaurer la vraie IP sans fermer l'origine, ce n'est pas une correction partielle : c'est un problème de journalisation transformé en contournement d'authentification.</p>

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
    'https://charrad.dev/assets/images/articles/vraie-ip-client-cloudflare.png',
    'PUBLISHED',
    NOW(),
    u.id,
    NOW(),
    NOW()
FROM users u WHERE u.email = 'admin@portfolio.dev'
ON CONFLICT (slug) DO NOTHING;
