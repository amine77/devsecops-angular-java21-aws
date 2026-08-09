# Design : Blog "Articles" pour le portfolio

Date : 2026-08-09
Statut : Approuvé (carte blanche utilisateur)

## Contexte et objectif

Ajouter une section "Blog" au portfolio pour publier des articles techniques qui
renforcent la crédibilité auprès des recruteurs. Au lancement : 3 articles,
rédigés librement par l'utilisateur depuis son espace d'administration existant
(pas de contenu pré-rempli par migration). Le blog doit suivre exactement les
patterns déjà en place pour `Project`/`Skill` (entité → repository → service →
DTO/mapper → controller côté backend ; feature standalone Angular avec
signals/OnPush côté frontend).

## Décisions validées

- **Format de contenu** : Markdown, rédigé dans un textarea admin avec aperçu
  live. Rendu HTML fait côté frontend uniquement (`marked` + sanitization
  `DOMPurify` avant `innerHTML`) — le backend stocke/renvoie du Markdown brut,
  jamais de HTML. Pas de moteur Markdown côté Java.
- **Champs de l'article** : titre, slug, résumé court, contenu Markdown, image
  de couverture (URL, pas d'upload — comme `Project.imageUrl`), statut
  brouillon/publié, tags libres, date de publication.
- **Tags** : liste de chaînes libres directement sur l'article
  (`@ElementCollection List<String>`), pas de table `Tag` dédiée. Filtrage par
  tag sur la page liste.
- **URL** : `/portfolio/blog` (liste) et `/portfolio/blog/:slug` (détail), même
  niveau que `/portfolio/projects` et `/portfolio/skills`. Slug généré
  automatiquement depuis le titre (normalisation accents/espaces), suffixe
  `-2`, `-3`... en cas de collision.
- **Page d'accueil** : nouvelle section "Derniers articles" (mêmes 3 derniers
  articles publiés), à côté de la section projets "featured" existante.
- **Sécurité/accès** : réutilise le système d'auth JWT + `ROLE_ADMIN` existant
  (`adminGuard`, `@PreAuthorize("hasRole('ADMIN')")`) — aucun nouveau mécanisme
  d'authentification.

## Backend

### Entité `Article` (package `entity`)

Champs : `id`, `title` (200), `slug` (255, unique, indexé), `summary` (500),
`content` (TEXT, Markdown), `coverImageUrl` (500, nullable), `tags`
(`@ElementCollection`, table `article_tags`), `status` (enum `ArticleStatus` :
`DRAFT`/`PUBLISHED`, défaut `DRAFT`), `publishedAt` (nullable, rempli au
premier passage en `PUBLISHED`), `user` (`@ManyToOne(LAZY)`, auteur),
`createdAt`, `updatedAt`. Style Lombok identique à `Project`
(`@Getter/@Setter/@Builder/@NoArgsConstructor/@AllArgsConstructor`,
`equals`/`hashCode` sur `id`).

### Migration `V10__create_articles.sql`

```sql
CREATE TABLE articles (
    id               BIGSERIAL     PRIMARY KEY,
    title            VARCHAR(200)  NOT NULL,
    slug             VARCHAR(255)  NOT NULL,
    summary          VARCHAR(500),
    content          TEXT          NOT NULL,
    cover_image_url  VARCHAR(500),
    status           VARCHAR(50)   NOT NULL DEFAULT 'DRAFT',
    published_at     TIMESTAMP,
    user_id          BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_articles_slug UNIQUE (slug)
);

CREATE TABLE article_tags (
    article_id BIGINT       NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    tag        VARCHAR(50)  NOT NULL
);

CREATE INDEX idx_articles_status       ON articles(status);
CREATE INDEX idx_articles_published_at ON articles(published_at);
CREATE INDEX idx_article_tags_tag      ON article_tags(tag);
```

Pas de seed de contenu : les 3 articles sont rédigés par l'utilisateur via
l'admin après déploiement.

### Repository / Service / Mapper / DTO

- `ArticleRepository extends JpaRepository<Article, Long>` avec
  `findByStatusOrderByPublishedAtDesc(ArticleStatus, Pageable)`,
  `findBySlugAndStatus(String, ArticleStatus)`, `existsBySlug(String)`, et une
  requête filtrée par tag (`JOIN article_tags`).
- `ArticleService` : `getPublished(Pageable, String tag)`,
  `getPublishedBySlug(String)` (404 si absent ou `DRAFT`),
  `getAllForAdmin(Pageable)`, `createArticle`, `updateArticle`,
  `deleteArticle`. Logique de génération de slug unique et de fixation de
  `publishedAt` centralisée ici.
- `ArticleMapper` manuel (même choix que `ProjectMapper`, pas de MapStruct).
- DTOs : `ArticleRequest` (title, summary, content, coverImageUrl, tags,
  status — validation `@NotBlank`/`@Size` comme `ProjectRequest`),
  `ArticleResponse` (tous les champs + `authorName`).

### Controller `ArticleController` (`/articles`)

- `GET /articles?page&size&tag=` — public, `PUBLISHED` uniquement
- `GET /articles/{slug}` — public
- `GET /articles/admin?page&size` — `@PreAuthorize("hasRole('ADMIN')")`, tous statuts
- `POST /articles`, `PUT /articles/{id}`, `DELETE /articles/{id}` —
  `@PreAuthorize("hasRole('ADMIN')")`

Même conventions que `ProjectController` : `ApiResponse<T>`/`PageResponse<T>`,
Swagger `@Tag`/`@Operation`/`@SecurityRequirement`, 201 pour la création, 204
pour la suppression.

## Frontend

### Public (`features/portfolio/blog/`)

- `blog-list/` (`/portfolio/blog`) : liste paginée, chips de filtre par tag,
  carte par article (image, titre, résumé, tags, date)
- `blog-detail/` (`/portfolio/blog/:slug`) : rendu Markdown → HTML via
  `marked`, sanitizé avec `DOMPurify` avant affichage (`[innerHTML]`), style
  éditorial (typographie, blocs de code)
- `ArticleService` (`core/services/`) : même forme que `ProjectService`
  (`getArticles`, `getArticleBySlug`, `createArticle`, `updateArticle`,
  `deleteArticle`, `getArticlesForAdmin`)
- Modèle `shared/models/article.model.ts`

### Intégration existante

- `navbar.component.ts` : lien "Blog" entre "Projets" et "Compétences"
- `home.component.ts` : nouvelle section "Derniers articles" (3 derniers
  publiés), même style que la section projets featured
- `portfolio.routes.ts` : routes `blog` et `blog/:slug`

### Admin (`features/admin/`)

- `article-form/` (`/admin/articles/new`, `/admin/articles/:id/edit`) :
  formulaire titre / résumé / tags (chips éditables) / image de couverture /
  textarea Markdown + aperçu live côte à côte / toggle brouillon-publié
- `dashboard.component.ts` étendu avec une table "Articles" (badge
  Brouillon/Publié, actions éditer/supprimer) à côté de la table "Projets"
  existante, alimentée par `GET /articles/admin`
- `admin.routes.ts` étendu avec les nouvelles routes, protégées par
  `adminGuard` comme l'existant

### Nouvelles dépendances frontend

`marked` (parsing Markdown→HTML) et `dompurify` (+ `@types/dompurify`)
(sanitization anti-XSS avant `innerHTML`). Aucune dépendance backend
supplémentaire.

## Tests

- Backend : tests unitaires `ArticleService` (génération/unicité de slug,
  transition `DRAFT→PUBLISHED`, filtrage par tag), tests `ArticleController`
  en `MockMvc` (public vs `ROLE_ADMIN`, 404 sur brouillon en accès public)
- Frontend : `.spec.ts` pour `ArticleService`, `blog-list`, `blog-detail`,
  `article-form`, extension du spec `dashboard.component`

## Hors scope (YAGNI)

- Upload d'image (on reste sur une URL, comme les projets)
- Éditeur WYSIWYG riche
- Table `Tag` dédiée avec CRUD propre
- Commentaires, réactions, RSS, sitemap dédié au blog
- Rendu Markdown côté backend
