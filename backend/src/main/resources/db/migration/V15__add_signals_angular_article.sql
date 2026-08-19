-- =============================================================================
-- V15__add_signals_angular_article.sql — Publie l'article "Signals Angular"
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
-- Un exemple de code de l'article contient un template literal JavaScript. La
-- séquence dollar-accolade qui l'ouvre est justement le préfixe des placeholders
-- de Flyway, et la substitution s'applique aussi À L'INTÉRIEUR du dollar-quoting :
-- laissée telle quelle, elle fait échouer le parsing de la migration (et donc le
-- démarrage du backend). Elle est donc écrite ici sous forme de sentinelle, que
-- le replace() ci-dessous reconstitue à l'insertion via chr(36) — le caractère
-- dollar n'apparaît ainsi jamais collé à l'accolade dans le fichier. Le contenu
-- stocké en base est identique à l'article d'origine.
--
-- L'image de couverture est servie en statique par le frontend
-- (frontend/src/assets/images/articles/), son URL est absolue car elle sert
-- aussi de og:image (les crawlers sociaux n'acceptent pas les chemins relatifs).
-- =============================================================================

INSERT INTO articles (title, slug, summary, content, content_type, cover_image_url, status, published_at, user_id, created_at, updated_at)
SELECT
    'Signals : l''état d''un côté, le temps de l''autre',
    'signals-angular-rxjs',
    'Non, les signals ne remplacent pas RxJS. Ils reprennent la moitié du travail que RxJS n''aurait jamais dû faire — et une fois cette frontière comprise, la plupart des débats disparaissent.',
    replace($article$
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Signals Angular : l'état d'un côté, le temps de l'autre</title>
<meta name="description" content="Comprendre les signals Angular sans les opposer à RxJS : graphe de dépendances, computed paresseux, pièges de l'effect, suivi dynamique, et où passe vraiment la frontière entre état et flux.">
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

  /* Langage visuel : l'état vs le temps */
  --state:#16A75C;        /* signal : une valeur */
  --state-soft:#E4F6EC;
  --time:#8B6BE8;         /* observable : des événements */
  --time-soft:#EFEAFC;
  --trap:#E23D4E;         /* piège */
  --trap-soft:#FCE8EA;
  --io:#EFA02B;

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
.hero h1 em{font-style:normal;color:var(--state)}
.hero h1 i{font-style:normal;color:var(--time)}
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
.k{color:#7FA9FF}.s{color:#8DE0A6}.c{color:#6B7FA3;font-style:italic}.a{color:#F2C46B}.t{color:#6FD2E2}.f{color:#C9A9FF}

.note{border-left:4px solid var(--volt);background:var(--volt-soft);padding:16px 20px;border-radius:0 8px 8px 0;margin:26px 0;font-size:17.5px}
.note .lbl{font-family:var(--mono);font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--volt);display:block;margin-bottom:6px;font-weight:700}
.note p:last-child{margin-bottom:0}
.note.warn{border-color:var(--trap);background:var(--trap-soft)}
.note.warn .lbl{color:var(--trap)}
.note.good{border-color:var(--state);background:var(--state-soft)}
.note.good .lbl{color:var(--state)}
.note.time{border-color:var(--time);background:var(--time-soft)}
.note.time .lbl{color:var(--time)}

.table-scroll{overflow-x:auto;margin:26px 0;border:1px solid var(--rule);border-radius:10px}
table{border-collapse:collapse;width:100%;font-size:15.5px;min-width:560px}
th{background:var(--wash);font-family:var(--mono);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;text-align:left;padding:12px 16px;color:var(--muted);font-weight:700;border-bottom:1px solid var(--rule)}
td{padding:13px 16px;border-bottom:1px solid var(--rule);vertical-align:top;line-height:1.5}
tr:last-child td{border-bottom:0}
td:first-child{width:38%}

.pitfall{display:grid;grid-template-columns:44px 1fr;gap:16px;padding:20px 0;border-bottom:1px solid var(--rule)}
.pitfall:last-of-type{border-bottom:0}
.pitfall .no{font-family:var(--mono);font-size:15px;font-weight:700;color:var(--trap);background:var(--trap-soft);border-radius:8px;height:36px;display:grid;place-items:center}
.pitfall h4{font-family:var(--display);font-size:18px;font-weight:600;margin:4px 0 6px}
.pitfall p{margin:0;font-size:17px}

.cheat{background:var(--ink);border-radius:14px;padding:32px;margin:44px 0;color:#fff}
.cheat h3{color:#fff;margin:0 0 4px;font-size:24px}
.cheat .sub{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#7E93BC;margin:0 0 26px}
.cheat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
.cheat-card{background:var(--ink-soft);border-radius:10px;padding:16px 18px;border-top:3px solid var(--volt)}
.cheat-card.c-state{border-color:var(--state)}
.cheat-card.c-time{border-color:var(--time)}
.cheat-card.c-trap{border-color:var(--trap)}
.cheat-card .h{font-family:var(--mono);font-size:12.5px;font-weight:700;letter-spacing:.06em;margin-bottom:8px}
.c-state .h{color:var(--state)}
.c-time .h{color:#B9A3F5}
.c-trap .h{color:var(--trap)}
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
    <p class="eyebrow">Angular · Signals · RxJS · Zoneless</p>
    <h1>Signals : l'<em>état</em> d'un côté, le <i>temps</i> de l'autre</h1>
    <p class="standfirst">Non, les signals ne remplacent pas RxJS. Ils reprennent la moitié du travail que RxJS n'aurait jamais dû faire — et une fois cette frontière comprise, la plupart des débats disparaissent.</p>
    <div class="byline">
      <span>Par <b>Amine Charrad</b></span>
      <span>·</span>
      <span>15 min de lecture</span>
      <span>·</span>
      <span>Angular 21 · TypeScript</span>
    </div>
  </div>
</header>

<div class="states-strip">
  <div class="wrap">
    <div class="state-chip">
      <div class="nm"><span class="dot" style="background:#16A75C"></span>SIGNAL</div>
      <div class="ds">Une valeur courante, toujours lisible. Pas de notion de temps.</div>
    </div>
    <div class="state-chip">
      <div class="nm"><span class="dot" style="background:#8B6BE8"></span>OBSERVABLE</div>
      <div class="ds">Des événements qui arrivent. Annulables, temporisables, rejouables.</div>
    </div>
    <div class="state-chip">
      <div class="nm"><span class="dot" style="background:#E23D4E"></span>EFFECT</div>
      <div class="ds">La sortie du graphe. Là où se logent la majorité des erreurs.</div>
    </div>
  </div>
</div>

<main>
<div class="wrap">

<p>Pendant dix ans, Angular a utilisé RxJS pour deux choses très différentes : représenter des <em>flux d'événements</em> — une requête HTTP, un clic, un websocket — et représenter l'<em>état</em> d'une interface, avec des <code>BehaviorSubject</code> partout.</p>

<p>La première utilisation est excellente. La seconde a produit une génération de composants où lire une valeur exigeait de s'abonner, où <code>| async</code> se répétait quatre fois dans le même template, et où l'ordre d'arrivée des valeurs devenait un sujet de débogage.</p>

<p>Les signals ne sont pas un RxJS plus simple. Ils traitent uniquement le second problème.</p>

<h2><span class="num">01 — La distinction</span>Une valeur n'est pas un flux</h2>

<p>Un signal contient une valeur, point. Vous pouvez la lire à tout moment, de façon synchrone, sans vous abonner à quoi que ce soit. Il n'a ni passé ni futur : seulement un présent.</p>

<p>Un observable, lui, décrit ce qui se produit <em>au fil du temps</em>. Il peut n'émettre jamais, émettre trois fois, échouer, être annulé, être retardé. Toute la richesse de RxJS — <code>debounceTime</code>, <code>switchMap</code>, <code>retry</code>, <code>takeUntil</code> — porte sur cette dimension temporelle.</p>

<figure>
<svg viewBox="0 0 760 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Comparaison entre un signal, qui contient une valeur courante, et un observable, qui émet des événements dans le temps">
  <rect width="760" height="300" fill="#0D1524"/>
  <g stroke="#2A3A5C" stroke-width="1" opacity=".35">
    <path d="M0 50H760M0 100H760M0 150H760M0 200H760M0 250H760"/>
    <path d="M60 0V300M160 0V300M260 0V300M360 0V300M460 0V300M560 0V300M660 0V300"/>
  </g>

  <!-- SIGNAL -->
  <text x="30" y="42" font-family="JetBrains Mono, monospace" font-size="13" font-weight="700" fill="#16A75C">SIGNAL</text>
  <text x="112" y="42" font-family="JetBrains Mono, monospace" font-size="11" fill="#7E93BC">une valeur, lisible à tout instant</text>

  <rect x="30" y="58" width="700" height="66" rx="10" fill="#0F2419" stroke="#16A75C" stroke-width="2"/>
  <text x="56" y="88" font-family="JetBrains Mono, monospace" font-size="13" fill="#8FE0B0">panier()</text>
  <text x="150" y="88" font-family="JetBrains Mono, monospace" font-size="13" fill="#FFFFFF">→ 3 articles</text>
  <text x="56" y="110" font-family="JetBrains Mono, monospace" font-size="11" fill="#7E93BC">lecture synchrone · aucun abonnement · toujours une réponse</text>

  <!-- OBSERVABLE -->
  <text x="30" y="172" font-family="JetBrains Mono, monospace" font-size="13" font-weight="700" fill="#B9A3F5">OBSERVABLE</text>
  <text x="152" y="172" font-family="JetBrains Mono, monospace" font-size="11" fill="#7E93BC">des événements, dans le temps</text>

  <path d="M30 218H700" stroke="#8B6BE8" stroke-width="2.5" marker-end="url(#s-arrow)"/>
  <g fill="#8B6BE8">
    <circle cx="110" cy="218" r="10"/>
    <circle cx="250" cy="218" r="10"/>
    <circle cx="330" cy="218" r="10"/>
    <circle cx="520" cy="218" r="10"/>
  </g>
  <text x="110" y="200" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#C9A9FF">saisie</text>
  <text x="250" y="200" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#C9A9FF">saisie</text>
  <text x="330" y="200" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#C9A9FF">saisie</text>
  <text x="520" y="200" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10.5" fill="#C9A9FF">réponse</text>
  <text x="714" y="223" font-family="JetBrains Mono, monospace" font-size="11" fill="#7E93BC">t</text>

  <text x="30" y="252" font-family="JetBrains Mono, monospace" font-size="11" fill="#7E93BC">annulable · temporisable · rejouable · peut échouer · peut ne rien émettre</text>

  <rect x="30" y="266" width="700" height="22" rx="6" fill="#17223A"/>
  <text x="380" y="281" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#C3D0E6">Un signal répond « quoi maintenant ». Un observable répond « quoi, et quand ».</text>

  <defs>
    <marker id="s-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9z" fill="#8B6BE8"/></marker>
  </defs>
</svg>
<figcaption><b>Fig. 1</b> — La question à se poser devant chaque morceau d'état : ai-je besoin de la valeur courante, ou de la séquence des valeurs ? La réponse détermine l'outil.</figcaption>
</figure>

<div class="note good">
  <span class="lbl">La règle en une phrase</span>
  <p>Si vous n'utilisez aucun opérateur temporel — pas de <code>debounceTime</code>, pas de <code>switchMap</code>, pas de <code>retry</code> — alors votre <code>BehaviorSubject</code> n'est qu'une variable compliquée. C'est exactement le cas que les signals remplacent.</p>
</div>

<h2><span class="num">02 — Le mécanisme</span>Un graphe, pas un flux</h2>

<p>Trois primitives suffisent à tout comprendre.</p>

<div class="code">
  <div class="code-head"><span>panier.store.ts</span><span>TypeScript</span></div>
<pre><span class="c">// 1. Une source : valeur modifiable</span>
<span class="k">const</span> lignes = <span class="f">signal</span>&lt;<span class="t">Ligne</span>[]&gt;([]);

<span class="c">// 2. Une dérivation : recalculée automatiquement, mise en cache</span>
<span class="k">const</span> total = <span class="f">computed</span>(() =&gt;
  lignes().<span class="f">reduce</span>((somme, l) =&gt; somme + l.prix * l.quantite, <span class="s">0</span>)
);

<span class="k">const</span> livraisonOfferte = <span class="f">computed</span>(() =&gt; total() &gt;= <span class="s">50</span>);

<span class="c">// 3. Un effet : la sortie du graphe, vers le monde extérieur</span>
<span class="f">effect</span>(() =&gt; {
  <span class="t">console</span>.log(<span class="s">`Total : @@DOLLAR@@{total()} €`</span>);
});</pre>
</div>

<p>Ce qui se passe derrière est plus intéressant que l'API. Angular construit un <strong>graphe de dépendances</strong> : en lisant <code>lignes()</code> à l'intérieur de <code>total</code>, il enregistre que <code>total</code> dépend de <code>lignes</code>. Aucune déclaration manuelle, aucun tableau de dépendances à maintenir.</p>

<p>Deux propriétés en découlent, et ce sont elles qui font la différence à l'usage.</p>

<p><strong>Le calcul est paresseux.</strong> Un <code>computed</code> n'est pas recalculé quand sa source change — il est seulement marqué comme périmé. Le calcul n'a lieu qu'à la prochaine lecture. Si personne ne lit <code>livraisonOfferte</code>, il n'est jamais évalué.</p>

<p><strong>La propagation est cohérente.</strong> Quand vous modifiez <code>lignes</code>, tout ce qui en dérive devient périmé d'un coup. Impossible d'observer un état intermédiaire où <code>total</code> serait à jour mais pas <code>livraisonOfferte</code> — le problème classique des <code>combineLatest</code> mal ordonnés.</p>

<figure>
<svg viewBox="0 0 760 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Graphe de dépendances entre signals, computed et effect">
  <rect width="760" height="320" fill="#0D1524"/>
  <g stroke="#2A3A5C" stroke-width="1" opacity=".35">
    <path d="M0 40H760M0 80H760M0 120H760M0 160H760M0 200H760M0 240H760M0 280H760"/>
    <path d="M60 0V320M160 0V320M260 0V320M360 0V320M460 0V320M560 0V320M660 0V320"/>
  </g>

  <text x="30" y="36" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="1.5" fill="#7E93BC">SOURCES</text>
  <text x="290" y="36" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="1.5" fill="#7E93BC">DÉRIVATIONS</text>
  <text x="600" y="36" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="1.5" fill="#7E93BC">SORTIES</text>

  <!-- liens -->
  <path d="M170 96 L280 116" stroke="#16A75C" stroke-width="2" marker-end="url(#d-arrow)"/>
  <path d="M170 196 L280 136" stroke="#16A75C" stroke-width="2" marker-end="url(#d-arrow)"/>
  <path d="M400 126 L470 126" stroke="#16A75C" stroke-width="2" marker-end="url(#d-arrow)"/>
  <path d="M400 136 L470 216" stroke="#16A75C" stroke-width="2" marker-end="url(#d-arrow)"/>
  <path d="M590 126 L640 126" stroke="#E23D4E" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#d-arrow-r)"/>
  <path d="M590 216 L640 216" stroke="#E23D4E" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#d-arrow-r)"/>

  <!-- sources -->
  <rect x="30" y="76" width="140" height="44" rx="8" fill="#0F2419" stroke="#16A75C" stroke-width="2"/>
  <text x="100" y="96" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" fill="#8FE0B0">lignes</text>
  <text x="100" y="112" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#7E93BC">signal</text>

  <rect x="30" y="176" width="140" height="44" rx="8" fill="#0F2419" stroke="#16A75C" stroke-width="2"/>
  <text x="100" y="196" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" fill="#8FE0B0">codePromo</text>
  <text x="100" y="212" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#7E93BC">signal</text>

  <!-- derivations -->
  <rect x="280" y="104" width="120" height="44" rx="8" fill="#17223A" stroke="#3566E8" stroke-width="2"/>
  <text x="340" y="124" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" fill="#8FB2FF">total</text>
  <text x="340" y="140" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#7E93BC">computed</text>

  <rect x="470" y="104" width="120" height="44" rx="8" fill="#17223A" stroke="#3566E8" stroke-width="2"/>
  <text x="530" y="124" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#8FB2FF">livraison</text>
  <text x="530" y="140" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#7E93BC">computed</text>

  <rect x="470" y="194" width="120" height="44" rx="8" fill="#17223A" stroke="#3566E8" stroke-width="2"/>
  <text x="530" y="214" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#8FB2FF">affichage</text>
  <text x="530" y="230" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#7E93BC">computed</text>

  <!-- sorties -->
  <rect x="640" y="104" width="94" height="44" rx="8" fill="#1E1420" stroke="#E23D4E" stroke-width="2"/>
  <text x="687" y="130" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#F3A8B0">template</text>

  <rect x="640" y="194" width="94" height="44" rx="8" fill="#1E1420" stroke="#E23D4E" stroke-width="2"/>
  <text x="687" y="220" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#F3A8B0">effect</text>

  <rect x="30" y="266" width="704" height="34" rx="8" fill="#17223A" stroke="#2A3A5C"/>
  <text x="382" y="288" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11.5" fill="#C3D0E6">Modifier une source périme tout l'aval d'un coup. Le calcul n'a lieu qu'à la lecture.</text>

  <defs>
    <marker id="d-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9z" fill="#16A75C"/></marker>
    <marker id="d-arrow-r" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9z" fill="#E23D4E"/></marker>
  </defs>
</svg>
<figcaption><b>Fig. 2</b> — Les sources sont écrites, les dérivations sont calculées, les sorties agissent. Une donnée qui se calcule à partir d'autres n'a rien à faire dans un <code>signal</code>.</figcaption>
</figure>

<h3>Le composant, une fois réécrit</h3>

<div class="code">
  <div class="code-head"><span>panier.component.ts</span><span>Angular 21</span></div>
<pre><span class="a">@Component</span>({
  selector: <span class="s">'app-panier'</span>,
  changeDetection: <span class="t">ChangeDetectionStrategy</span>.OnPush,
  template: <span class="s">`
    &lt;p&gt;{{ total() }} €&lt;/p&gt;
    &#64;if (livraisonOfferte()) {
      &lt;p class="ok"&gt;Livraison offerte&lt;/p&gt;
    }
    &lt;button (click)="ajouter(article)"&gt;Ajouter&lt;/button&gt;
  `</span>
})
<span class="k">export class</span> <span class="t">PanierComponent</span> {
  <span class="c">// Entrée typée, sans @Input() ni ngOnChanges</span>
  <span class="k">readonly</span> client = <span class="f">input</span>.required&lt;<span class="t">Client</span>&gt;();

  <span class="k">private readonly</span> lignes = <span class="f">signal</span>&lt;<span class="t">Ligne</span>[]&gt;([]);

  <span class="k">readonly</span> total = <span class="f">computed</span>(() =&gt;
    <span class="k">this</span>.lignes().<span class="f">reduce</span>((s, l) =&gt; s + l.prix * l.quantite, <span class="s">0</span>)
  );

  <span class="k">readonly</span> livraisonOfferte = <span class="f">computed</span>(() =&gt;
    <span class="k">this</span>.total() &gt;= <span class="k">this</span>.client().seuilFrancoPort
  );

  ajouter(article: <span class="t">Article</span>): <span class="k">void</span> {
    <span class="c">// Nouvelle référence obligatoire — voir le piège n°1</span>
    <span class="k">this</span>.lignes.<span class="f">update</span>(l =&gt; [...l, <span class="t">Ligne</span>.de(article)]);
  }
}</pre>
</div>

<p>Aucun <code>subscribe</code>, aucun <code>| async</code>, aucun <code>ngOnDestroy</code> pour nettoyer. Le template lit <code>total()</code> et Angular sait exactement quoi rafraîchir — c'est aussi ce qui rend possible la détection de changements sans Zone.js.</p>

<div class="note">
  <span class="lbl">Le lien avec le mode zoneless</span>
  <p>Zone.js fonctionnait en interceptant tout ce qui est asynchrone dans le navigateur, puis en revérifiant l'arbre de composants « au cas où ». Avec les signals, un composant déclare précisément ce qu'il lit : Angular n'a plus besoin de deviner. C'est le même mécanisme qui alimente les deux sujets.</p>
</div>

<h2><span class="num">03 — Le piège principal</span>effect n'est pas un abonnement</h2>

<p>C'est de loin l'erreur la plus répandue. Venant de RxJS, on lit <code>effect()</code> comme un <code>subscribe()</code>, et on l'utilise pour synchroniser un signal avec un autre.</p>

<div class="code">
  <div class="code-head"><span>À ne pas faire</span><span>TypeScript</span></div>
<pre><span class="c">// ✕ effect utilisé pour dériver de l'état</span>
<span class="k">readonly</span> total = <span class="f">signal</span>(<span class="s">0</span>);

<span class="k">constructor</span>() {
  <span class="f">effect</span>(() =&gt; {
    <span class="k">this</span>.total.<span class="f">set</span>(<span class="k">this</span>.lignes().<span class="f">reduce</span>(...));
  });
}</pre>
</div>

<p>Ça fonctionne, et c'est pourtant à jeter. Vous avez recréé à la main ce que <code>computed</code> fait mieux : le calcul devient impératif, il s'exécute même si personne ne lit le résultat, il introduit un décalage d'un tour entre la source et la dérivée, et il ouvre la porte aux boucles de mise à jour.</p>

<div class="code">
  <div class="code-head"><span>À faire</span><span>TypeScript</span></div>
<pre><span class="c">// ✓ une dérivation est un computed</span>
<span class="k">readonly</span> total = <span class="f">computed</span>(() =&gt;
  <span class="k">this</span>.lignes().<span class="f">reduce</span>(...)
);</pre>
</div>

<p>Un <code>effect</code> ne devrait servir qu'à sortir du graphe : journalisation, écriture dans le <code>localStorage</code>, appel à une bibliothèque tierce impérative, synchronisation avec le titre du document. Si le résultat de votre effet est un autre signal, c'est presque toujours un <code>computed</code> qu'il vous fallait.</p>

<div class="note warn">
  <span class="lbl">Le cas légitime</span>
  <p>Il existe une exception : un état modifiable par l'utilisateur mais qui doit se réinitialiser quand une source change — un formulaire remis à zéro au changement d'entité, par exemple. C'est précisément ce que <code>linkedSignal()</code> résout, et c'est plus sûr qu'un <code>effect</code> écrivant dans un <code>signal</code>.</p>
</div>

<h2><span class="num">04 — Le piège discret</span>Les dépendances sont dynamiques</h2>

<p>Le suivi des dépendances se fait à l'exécution, pas à la déclaration. Un <code>computed</code> ne dépend que des signals qu'il a <strong>réellement lus</strong> lors de son dernier calcul.</p>

<div class="code">
  <div class="code-head"><span>Dépendance conditionnelle</span><span>TypeScript</span></div>
<pre><span class="k">readonly</span> resume = <span class="f">computed</span>(() =&gt; {
  <span class="k">if</span> (!<span class="k">this</span>.afficherDetail()) {
    <span class="k">return</span> <span class="s">'—'</span>;              <span class="c">// detail() n'est pas lu ici</span>
  }
  <span class="k">return</span> <span class="k">this</span>.detail().libelle;  <span class="c">// donc pas de dépendance tant que c'est faux</span>
});</pre>
</div>

<p>Tant que <code>afficherDetail()</code> vaut <code>false</code>, modifier <code>detail</code> ne périme rien. Le comportement est correct et même souhaitable — c'est ce qui rend le système efficace — mais il surprend quand on débogue en pensant en termes d'abonnements figés.</p>

<p>La contrepartie, c'est <code>untracked()</code> : lire un signal sans créer de dépendance.</p>

<div class="code">
  <div class="code-head"><span>Lecture sans dépendance</span><span>TypeScript</span></div>
<pre><span class="f">effect</span>(() =&gt; {
  <span class="k">const</span> id = <span class="k">this</span>.commandeId();          <span class="c">// déclenche l'effet</span>
  <span class="k">const</span> user = <span class="f">untracked</span>(() =&gt; <span class="k">this</span>.utilisateur());  <span class="c">// contexte seulement</span>
  <span class="k">this</span>.analytics.suivre(id, user.segment);
});</pre>
</div>

<p>Ici, l'effet se redéclenche au changement de commande, mais pas quand l'utilisateur est rechargé. Sans <code>untracked</code>, vous auriez deux déclencheurs là où vous n'en vouliez qu'un.</p>

<h2><span class="num">05 — La frontière</span>Où placer RxJS, où placer les signals</h2>

<p>La bonne architecture ne consiste pas à choisir l'un ou l'autre, mais à leur donner chacun un territoire. RxJS aux <strong>bords</strong> de l'application, là où le temps intervient. Les signals au <strong>centre</strong>, là où vit l'état.</p>

<figure>
<svg viewBox="0 0 760 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="RxJS aux bords de l'application pour les flux, signals au centre pour l'état">
  <rect width="760" height="300" fill="#0D1524"/>
  <g stroke="#2A3A5C" stroke-width="1" opacity=".3">
    <path d="M0 50H760M0 100H760M0 150H760M0 200H760M0 250H760"/>
    <path d="M60 0V300M160 0V300M260 0V300M360 0V300M460 0V300M560 0V300M660 0V300"/>
  </g>

  <!-- zone RxJS gauche -->
  <rect x="24" y="46" width="176" height="208" rx="12" fill="#1B1730" stroke="#8B6BE8" stroke-width="2"/>
  <text x="112" y="74" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#B9A3F5">RxJS · ENTRÉES</text>
  <g font-family="JetBrains Mono, monospace" font-size="11" fill="#C3D0E6">
    <text x="44" y="106">HttpClient</text>
    <text x="44" y="130">websocket</text>
    <text x="44" y="154">saisie debouncée</text>
    <text x="44" y="178">router events</text>
    <text x="44" y="202">retry · switchMap</text>
    <text x="44" y="226">takeUntilDestroyed</text>
  </g>

  <!-- zone signals centre -->
  <rect x="248" y="46" width="264" height="208" rx="12" fill="#0F2419" stroke="#16A75C" stroke-width="2.5"/>
  <text x="380" y="74" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#8FE0B0">SIGNALS · ÉTAT</text>
  <g font-family="JetBrains Mono, monospace" font-size="11" fill="#C3D0E6">
    <text x="272" y="106">état du composant</text>
    <text x="272" y="130">état partagé (store)</text>
    <text x="272" y="154">valeurs dérivées</text>
    <text x="272" y="178">état de formulaire</text>
    <text x="272" y="202">filtres, tri, pagination</text>
    <text x="272" y="226">tout ce que lit le template</text>
  </g>

  <!-- zone sorties droite -->
  <rect x="560" y="46" width="176" height="208" rx="12" fill="#1E1420" stroke="#E23D4E" stroke-width="2"/>
  <text x="648" y="74" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#F3A8B0">SORTIES</text>
  <g font-family="JetBrains Mono, monospace" font-size="11" fill="#C3D0E6">
    <text x="580" y="106">template</text>
    <text x="580" y="130">localStorage</text>
    <text x="580" y="154">titre du document</text>
    <text x="580" y="178">analytics</text>
    <text x="580" y="202">libs impératives</text>
    <text x="580" y="226">(via effect)</text>
  </g>

  <!-- ponts -->
  <path d="M204 150H244" stroke="#EFA02B" stroke-width="2.5" marker-end="url(#f-arrow)"/>
  <rect x="176" y="262" width="130" height="26" rx="13" fill="#0D1524"/>
  <text x="241" y="280" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#F6C784">toSignal()</text>

  <path d="M516 150H556" stroke="#EFA02B" stroke-width="2.5" marker-end="url(#f-arrow)"/>
  <rect x="470" y="262" width="150" height="26" rx="13" fill="#0D1524"/>
  <text x="545" y="280" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#F6C784">effect() · template</text>

  <defs>
    <marker id="f-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9z" fill="#EFA02B"/></marker>
  </defs>
</svg>
<figcaption><b>Fig. 3</b> — Le flux entre par la gauche, se transforme en état au centre, ressort par la droite. Les deux ponts sont <code>toSignal()</code> et <code>effect()</code>.</figcaption>
</figure>

<p>En pratique, le pont côté entrée est une seule fonction.</p>

<div class="code">
  <div class="code-head"><span>recherche.component.ts</span><span>Angular 21</span></div>
<pre><span class="k">import</span> { toSignal, toObservable } <span class="k">from</span> <span class="s">'@angular/core/rxjs-interop'</span>;

<span class="k">export class</span> <span class="t">RechercheComponent</span> {
  <span class="c">// État : un signal, écrit par le template</span>
  <span class="k">readonly</span> terme = <span class="f">signal</span>(<span class="s">''</span>);

  <span class="c">// Temps : RxJS fait ce qu'il sait faire — temporiser et annuler</span>
  <span class="k">private readonly</span> resultats$ = <span class="f">toObservable</span>(<span class="k">this</span>.terme).<span class="f">pipe</span>(
    <span class="f">debounceTime</span>(<span class="s">300</span>),
    <span class="f">distinctUntilChanged</span>(),
    <span class="f">switchMap</span>(t =&gt; <span class="k">this</span>.api.<span class="f">chercher</span>(t)),   <span class="c">// annule la requête précédente</span>
    <span class="f">catchError</span>(() =&gt; <span class="f">of</span>([]))
  );

  <span class="c">// Retour à l'état : le template ne voit qu'un signal</span>
  <span class="k">readonly</span> resultats = <span class="f">toSignal</span>(<span class="k">this</span>.resultats$, { initialValue: [] });
}</pre>
</div>

<p>Cinq lignes de RxJS pour ce que RxJS fait le mieux — temporiser, dédupliquer, annuler la requête obsolète — et un signal pour ce que le template consomme. Personne ne s'abonne, personne ne se désabonne : <code>toSignal</code> gère le cycle de vie via l'injecteur du composant.</p>

<div class="note time">
  <span class="lbl">Ce que les signals ne feront jamais</span>
  <p>Annuler une requête en vol, temporiser une saisie, réessayer trois fois avec un délai croissant, fusionner deux sources d'événements, garantir un ordre d'arrivée. Toutes ces opérations portent sur le temps. Un signal n'a pas de temps — il a une valeur courante.</p>
</div>

<h2><span class="num">06 — Terrain</span>Cinq erreurs qui reviennent</h2>

<div class="pitfall">
  <div class="no">01</div>
  <div>
    <h4>Muter l'objet au lieu de le remplacer</h4>
    <p>Les signals comparent par défaut avec <code>Object.is</code>. Faire <code>lignes().push(x)</code> puis <code>lignes.set(lignes())</code> ne déclenche rien : la référence n'a pas changé. Il faut toujours produire une nouvelle valeur, avec <code>update</code> et un <em>spread</em>.</p>
  </div>
</div>

<div class="pitfall">
  <div class="no">02</div>
  <div>
    <h4>Mettre dans un signal ce qui devrait être un computed</h4>
    <p>Si une valeur se calcule à partir d'autres, elle n'est pas une source. La déclarer en <code>signal</code> vous oblige à la maintenir à la main, et c'est là que naissent les incohérences d'affichage.</p>
  </div>
</div>

<div class="pitfall">
  <div class="no">03</div>
  <div>
    <h4>Oublier les parenthèses dans le template</h4>
    <p><code>{{ total }}</code> affiche la fonction, pas la valeur. Le compilateur ne le signale pas toujours, et le rendu montre quelque chose comme <code>function computed()</code>. Erreur bête, mais qui coûte dix minutes la première fois.</p>
  </div>
</div>

<div class="pitfall">
  <div class="no">04</div>
  <div>
    <h4>Faire du travail coûteux dans un computed</h4>
    <p>Un <code>computed</code> est recalculé à chaque lecture qui suit une invalidation. Un tri sur dix mille éléments à cet endroit se paiera à chaque rendu. Découpez en dérivations intermédiaires, ou déplacez le calcul hors du graphe.</p>
  </div>
</div>

<div class="pitfall">
  <div class="no">05</div>
  <div>
    <h4>Migrer tout RxJS d'un coup</h4>
    <p>La migration rentable est celle des <code>BehaviorSubject</code> qui ne servent qu'à stocker une valeur. Les pipelines qui utilisent réellement des opérateurs temporels doivent rester tels quels — les convertir en signals revient à réécrire à la main ce que RxJS fait déjà bien.</p>
  </div>
</div>

<h2><span class="num">07 — Arbitrage</span>Le tableau de décision</h2>

<div class="table-scroll">
<table>
  <thead><tr><th>Ce que vous avez</th><th>Ce qu'il faut utiliser</th></tr></thead>
  <tbody>
    <tr><td>Un <code>BehaviorSubject</code> sans aucun opérateur</td><td><code>signal()</code> — migration directe, gain immédiat</td></tr>
    <tr><td>Une valeur calculée à partir d'autres</td><td><code>computed()</code>, jamais un <code>signal</code> synchronisé</td></tr>
    <tr><td>Un état modifiable qui doit se réinitialiser</td><td><code>linkedSignal()</code></td></tr>
    <tr><td>Un appel HTTP avec annulation ou retry</td><td>RxJS, puis <code>toSignal()</code> à la frontière</td></tr>
    <tr><td>Une saisie à temporiser</td><td><code>toObservable()</code> + <code>debounceTime</code> + <code>toSignal()</code></td></tr>
    <tr><td>Une écriture vers l'extérieur</td><td><code>effect()</code> — et seulement ce cas</td></tr>
    <tr><td>Un websocket, des événements fusionnés</td><td>RxJS, sans hésiter</td></tr>
  </tbody>
</table>
</div>

<h2><span class="num">08 — Récapitulatif</span>La fiche à garder sous la main</h2>

<div class="cheat">
  <h3>Signals Angular — l'essentiel</h3>
  <p class="sub">Angular · Signals · rxjs-interop</p>
  <div class="cheat-grid">
    <div class="cheat-card c-state">
      <div class="h">● ÉTAT</div>
      <ul>
        <li><code>signal(v)</code> · <code>set()</code> · <code>update()</code></li>
        <li><code>computed()</code> pour toute dérivation</li>
        <li><code>linkedSignal()</code> pour l'état réinitialisable</li>
      </ul>
    </div>
    <div class="cheat-card c-time">
      <div class="h">● TEMPS</div>
      <ul>
        <li>RxJS pour annuler, temporiser, réessayer</li>
        <li><code>toSignal(obs$, {initialValue})</code></li>
        <li><code>toObservable(sig)</code></li>
      </ul>
    </div>
    <div class="cheat-card c-trap">
      <div class="h">✕ PIÈGES</div>
      <ul>
        <li><code>effect()</code> qui écrit un signal</li>
        <li>Mutation sans nouvelle référence</li>
        <li>Parenthèses oubliées dans le template</li>
      </ul>
    </div>
    <div class="cheat-card">
      <div class="h">⚙ COMPOSANT</div>
      <ul>
        <li><code>input()</code> · <code>input.required()</code></li>
        <li><code>model()</code> pour le two-way</li>
        <li><code>viewChild()</code> · <code>contentChild()</code></li>
      </ul>
    </div>
    <div class="cheat-card">
      <div class="h">◉ COMPORTEMENT</div>
      <ul>
        <li><code>computed</code> paresseux et mémoïsé</li>
        <li>Dépendances suivies à l'exécution</li>
        <li><code>untracked()</code> pour lire sans dépendre</li>
      </ul>
    </div>
    <div class="cheat-card">
      <div class="h">△ MIGRATION</div>
      <ul>
        <li>Commencer par les <code>BehaviorSubject</code> nus</li>
        <li>Garder les pipelines temporels</li>
        <li>Un composant à la fois</li>
      </ul>
    </div>
  </div>
</div>

<h2><span class="num">09 — Pour finir</span>Ce que le débat a masqué</h2>

<p>« Les signals remplacent-ils RxJS ? » était une mauvaise question, et elle a fait perdre deux ans à beaucoup d'équipes. La bonne question est plus ennuyeuse : cette donnée est-elle un état ou un flux ?</p>

<p>La plupart du temps, c'est un état — un filtre sélectionné, une ligne dépliée, un total. Ces valeurs n'ont jamais eu besoin d'opérateurs, de désabonnement ni de gestion d'ordre. Elles étaient dans des observables parce que c'était le seul outil disponible.</p>

<p>Le reste — ce qui arrive du réseau, ce que l'utilisateur tape trop vite, ce qu'il faut annuler — reste du flux, et restera du domaine de RxJS. Les deux modèles ne se concurrencent pas : ils décrivent deux choses différentes qu'on avait pris l'habitude de confondre.</p>

<div class="bio">
  <div class="who">Amine Charrad</div>
  <p>12 ans de développement fullstack Java et Angular. Tech Lead, actuellement sur des applications à fort trafic dans le secteur de l'assurance. J'écris ici sur Java, Spring, Angular et tout ce qui se passe entre le code et la production — <a href="https://charrad.dev">charrad.dev</a></p>
</div>

</div>
</main>
</body>
</html>

$article$, '@@DOLLAR@@', chr(36)),
    'HTML',
    'https://charrad.dev/assets/images/articles/signals-angular-rxjs.png',
    'PUBLISHED',
    NOW(),
    u.id,
    NOW(),
    NOW()
FROM users u WHERE u.email = 'admin@portfolio.dev'
ON CONFLICT (slug) DO NOTHING;
