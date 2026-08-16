# Design : Articles blog "HTML designé" (Shadow DOM)

Date : 2026-08-15
Statut : Approuvé

## Contexte et objectif

Le blog (voir [2026-08-09-blog-articles-design.md](2026-08-09-blog-articles-design.md))
ne supporte aujourd'hui que du contenu Markdown, rendu via `marked` +
`DOMPurify`. L'utilisateur rédige désormais certains articles comme des pages
HTML autonomes richement designées (hero, typographie custom, polices Google
Fonts, schémas SVG, cheat-sheets) — voir `articles/circuit-breaker-resilience4j.html`
comme premier exemple. Ce style d'article va se répéter dans le temps.

Un tel document ne peut pas être collé tel quel dans le champ Markdown
existant : son bloc `<style>` et ses balises `<html>/<head>/<body>` seraient
supprimés par DOMPurify, et le CSS restant (sélecteurs génériques `body`,
`h2`, `p`, `table`...) casserait le style du reste du site s'il n'était pas
filtré.

Objectif : permettre de publier ce type d'article en préservant son design
exact, sans qu'il n'affecte jamais le reste du site, en réutilisant au
maximum l'infrastructure blog existante (entité `Article`, formulaire admin,
pages publiques).

## Décisions validées

- **Portée** : fonctionnalité réutilisable (pas un hack pour un seul
  article) — d'autres articles "HTML designé" sont attendus.
- **Isolation CSS** : Shadow DOM natif du navigateur. Le contenu reste dans
  le flux de la page (pas d'iframe) — navigation, SEO et accessibilité ne
  sont pas dégradés. Nécessite de réécrire `:root` → `:host` dans le CSS
  extrait pour éviter la fuite des custom properties vers le vrai document
  (particularité de la spec CSS : `:root` cible toujours l'élément racine du
  document, même écrit depuis un `<style>` situé dans un shadow tree).
- **Flux auteur** : le formulaire admin existant (textarea + aperçu) gagne un
  sélecteur de mode "Markdown / HTML designé" par article. En mode HTML, le
  textarea reçoit le document HTML complet collé tel quel (doctype, `<head>`
  avec `<style>` et les `<link>` Google Fonts, `<body>`) — pas de conversion,
  pas d'import de fichier.
- **Polices externes** : Google Fonts (`fonts.googleapis.com`,
  `fonts.gstatic.com`) autorisées dans la CSP, pour préserver la typographie
  exacte de ce type d'article.
- **Rétrocompatibilité** : les articles existants restent `MARKDOWN` par
  défaut ; aucune conversion rétroactive.

## Backend

### Migration `V11__add_article_content_type.sql`

```sql
ALTER TABLE articles
    ADD COLUMN content_type VARCHAR(20) NOT NULL DEFAULT 'MARKDOWN';
```

### Entité `Article`

Nouveau champ :

```java
@Enumerated(EnumType.STRING)
@Column(name = "content_type", nullable = false, length = 20)
@Builder.Default
private ArticleContentType contentType = ArticleContentType.MARKDOWN;
```

Nouvel enum `ArticleContentType { MARKDOWN, HTML }` (package `entity`, même
style que `ArticleStatus`).

### DTO / Mapper

- `ArticleRequest` : ajoute `ArticleContentType contentType` (`@NotNull`,
  comme `status`).
- `ArticleResponse` : ajoute `contentType`.
- `ArticleMapper` : mappe le nouveau champ dans les deux sens.

Le champ `content` (TEXT) ne change pas de type : en mode `HTML` il contient
le document complet tel que collé. Aucune validation de structure HTML côté
backend — la sécurité du rendu reste entièrement portée par le frontend
(DOMPurify), comme c'est déjà le cas pour le Markdown. La création/édition
d'article reste réservée à `ROLE_ADMIN` (`ArticleController` inchangé sur ce
point) ; ce n'est pas un canal ouvert à du contenu non fiable.

### Tests backend

- `ArticleServiceTest` / mapper : `contentType` par défaut `MARKDOWN` si non
  fourni sur un article existant (migration), round-trip `HTML` sur
  create/update.
- `ArticleControllerTest` : `contentType` transite correctement dans les
  payloads JSON.

## Frontend

### Modèle (`shared/models/article.model.ts`)

```ts
export type ArticleContentType = 'MARKDOWN' | 'HTML';

export interface Article {
  // ...champs existants
  readonly contentType: ArticleContentType;
}

export interface ArticleFormData {
  // ...champs existants
  contentType: ArticleContentType;
}
```

### Composant partagé `RichHtmlArticleComponent`

Nouveau composant standalone, `shared/components/rich-html-article/`, utilisé
par `blog-detail.component.ts` (rendu public) et `article-form.component.ts`
(aperçu admin) quand `contentType === 'HTML'`.

Responsabilités, au montage (`ngAfterViewInit`) et à chaque changement du
contenu (`@Input() content: string`) :

1. Parser la chaîne avec `DOMParser` (`text/html`).
2. Extraire du `<head>` :
   - les `<link rel="preconnect">` et `<link rel="stylesheet">` dont l'`href`
     pointe vers `fonts.googleapis.com` ou `fonts.gstatic.com` (whitelist
     stricte de domaines — tout autre `<link>` est ignoré) ;
   - le texte de chaque `<style>`.
3. Réécrire, dans le CSS extrait, chaque occurrence du sélecteur `:root` en
   `:host` (regex ciblée sur le token `:root`, pas de parsing CSS complet —
   suffisant car ce cas ne survient que dans le bloc `:root{...}` de tête
   généré par le même gabarit d'article).
4. Extraire l'`innerHTML` du `<body>`.
5. Sanitizer l'ensemble (`link` + `style` réécrit + body) avec **DOMPurify**,
   config dédiée `RICH_HTML_SANITIZE_CONFIG` :
   - `ADD_TAGS: ['style', 'link']` (en plus des tags par défaut, dont les
     tags SVG déjà couverts) ;
   - `ADD_ATTR` restreint pour `link` à `rel`, `href`, `crossorigin`, avec un
     hook `afterSanitizeAttributes` qui supprime toute balise `link` dont
     l'`href` ne commence pas par `https://fonts.googleapis.com/` ou
     `https://fonts.gstatic.com/` ;
   - comportement par défaut de DOMPurify conservé pour le reste : `script`,
     attributs `on*`, URLs `javascript:` toujours retirés.
6. Créer un `<div>` hôte (`ElementRef`), lui attacher un Shadow DOM natif
   (`this.host.nativeElement.attachShadow({ mode: 'open' })` s'il n'existe
   pas déjà), puis injecter `shadowRoot.innerHTML = sanitized`.

Le rendu Markdown existant (`marked` + DOMPurify classique, `[innerHTML]`
Angular direct) reste strictement inchangé pour `contentType === 'MARKDOWN'`.

### `blog-detail.component.ts`

Le bloc `.bd-content` bascule conditionnellement :

```html
@if (article()!.contentType === 'HTML') {
  <app-rich-html-article [content]="article()!.content" />
} @else {
  <div class="bd-content" [innerHTML]="renderedHtml()"></div>
}
```

### `article-form.component.ts`

- Nouveau contrôle réactif `contentType` (`mat-button-toggle-group`,
  valeurs `MARKDOWN` / `HTML`, défaut `MARKDOWN`).
- Le `<textarea formControlName="content">` reste le même champ pour les
  deux modes.
- Le panneau "Aperçu" bascule comme dans `blog-detail` : rendu Markdown
  existant, ou `<app-rich-html-article [content]="form.value.content">` en
  mode HTML.

### CSP (`frontend/nginx.conf`)

```
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
```

(`script-src 'self'` inchangé — aucun script externe requis par ce type de
contenu.)

### Nouvelles dépendances

Aucune — `dompurify` et `marked` sont déjà des dépendances du projet.

### Tests frontend

- `RichHtmlArticleComponent` (`.spec.ts`) :
  - extraction correcte `link`/`style`/`body` sur un document complet type
    `circuit-breaker-resilience4j.html` ;
  - réécriture `:root` → `:host` ;
  - filtrage des `link` hors whitelist (ex. `href="https://evil.example/x.css"`
    retiré) ;
  - cas XSS classiques neutralisés : `<script>alert(1)</script>`,
    `<img onerror="...">`, `href="javascript:..."` ;
  - le shadow root est bien attaché et contient le HTML sanitizé (pas de
    fuite dans le DOM léger du composant).
- `blog-detail.component.spec.ts` / `article-form.component.spec.ts` :
  extension pour couvrir la bascule Markdown/HTML.

## Hors scope (YAGNI)

- Import de fichier `.html` depuis le formulaire admin (copier-coller
  suffit pour l'instant).
- Éditeur WYSIWYG pour le mode HTML.
- Rétro-conversion des articles Markdown existants vers HTML, ou l'inverse.
- Isolation par `<iframe sandbox>` (écarté au profit du Shadow DOM — voir
  section Décisions validées).
- Whitelist de domaines de polices externes configurable (seuls Google
  Fonts sont supportés pour l'instant ; à revisiter si un futur article a
  besoin d'un autre fournisseur).
