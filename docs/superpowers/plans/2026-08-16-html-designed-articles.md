# Articles "HTML designé" (Shadow DOM) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de publier des articles de blog "HTML designé" (document HTML autonome avec son propre CSS et polices Google Fonts) en plus des articles Markdown existants, en isolant leur CSS du reste du site via Shadow DOM natif.

**Architecture:** Nouveau champ `contentType` (`MARKDOWN` | `HTML`) sur l'entité `Article` et ses DTOs, propagé sans changement du type `content` (TEXT). Nouveau composant Angular partagé `RichHtmlArticleComponent` qui parse le HTML collé, extrait `<link>` Google Fonts + `<style>` (réécrit `:root`→`:host`) + `<body>`, sanitize avec DOMPurify (config dédiée + hook de whitelist) et injecte le résultat dans un Shadow DOM natif attaché à un `<div>` hôte. Utilisé à la fois côté public (`blog-detail`) et côté admin (aperçu du formulaire), en bascule conditionnelle sur `contentType`. Le pipeline Markdown existant (`marked` + DOMPurify + `[innerHTML]`) reste strictement inchangé.

**Tech Stack:** Spring Boot / JPA / Flyway (backend), Angular 21 standalone components + Angular Material + DOMPurify + `marked` (frontend), Jest + Angular TestBed, JUnit 5 + Mockito + AssertJ.

**Spec:** `docs/superpowers/specs/2026-08-15-html-designed-articles-design.md`

## Global Constraints

- Aucune nouvelle dépendance : `dompurify` et `marked` sont déjà installés.
- Rétrocompatibilité stricte : tout article existant reste `contentType = MARKDOWN` (défaut en DB et dans les DTOs).
- Sécurité : aucune validation de structure HTML côté backend ; la sanitization reste entièrement responsabilité du frontend (DOMPurify), comme pour le Markdown. Les endpoints d'écriture restent `ROLE_ADMIN` uniquement (inchangé).
- CSS isolation : Shadow DOM natif (`attachShadow({mode:'open'})`), pas d'iframe.
- Polices externes whitelistées strictement à `fonts.googleapis.com` et `fonts.gstatic.com` (comparaison sur l'origine complète via `new URL(href).origin`, pas un simple `startsWith` — certains `<link rel="preconnect">` Google Fonts n'ont pas de `/` final, ex. `href="https://fonts.gstatic.com"`).
- Ordre de champ retenu (nouveau champ `contentType`/`content_type` placé juste après `content`) : à respecter dans l'entité, `ArticleRequest`, `ArticleResponse`, `ArticleMapper` et le modèle TypeScript, pour rester cohérent entre les couches.
- Ne pas pousser sur `main` avant que l'utilisateur ait validé le rendu de l'article HTML en local dans son navigateur (voir Tâche 11).

---

## Backend

### Tâche 1 : Migration + enum `ArticleContentType` + champ sur l'entité `Article`

**Files:**
- Create: `backend/src/main/resources/db/migration/V11__add_article_content_type.sql`
- Create: `backend/src/main/java/com/portfolio/backend/entity/ArticleContentType.java`
- Modify: `backend/src/main/java/com/portfolio/backend/entity/Article.java`

**Interfaces:**
- Produces: `ArticleContentType` enum (`MARKDOWN`, `HTML`), `Article.getContentType()` / `Article.setContentType()`, `Article.builder().contentType(...)` (défaut `MARKDOWN` via `@Builder.Default`).

- [ ] **Step 1: Créer la migration**

```sql
ALTER TABLE articles
    ADD COLUMN content_type VARCHAR(20) NOT NULL DEFAULT 'MARKDOWN';
```

- [ ] **Step 2: Créer l'enum**

```java
package com.portfolio.backend.entity;

public enum ArticleContentType {
    MARKDOWN,
    HTML
}
```

- [ ] **Step 3: Ajouter le champ sur l'entité**

Dans `Article.java`, insérer le champ juste après `content` (ligne 49) :

```java
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "content_type", nullable = false, length = 20)
    @Builder.Default
    private ArticleContentType contentType = ArticleContentType.MARKDOWN;

    @Column(name = "cover_image_url", length = 500)
    private String coverImageUrl;
```

- [ ] **Step 4: Compiler et lancer la suite backend existante pour vérifier l'absence de régression**

Run: `cd backend && ./mvnw test -DskipITs`
Expected: PASS (le défaut `@Builder.Default` préserve la compatibilité — aucun appelant existant ne référence encore `contentType`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/db/migration/V11__add_article_content_type.sql backend/src/main/java/com/portfolio/backend/entity/ArticleContentType.java backend/src/main/java/com/portfolio/backend/entity/Article.java
git commit -m "feat(backend): ajoute le champ contentType sur l'entité Article"
```

---

### Tâche 2 : `ArticleRequest` / `ArticleResponse` / `ArticleMapper` / `ArticleService` + tests de service

**Files:**
- Modify: `backend/src/main/java/com/portfolio/backend/dto/request/ArticleRequest.java`
- Modify: `backend/src/main/java/com/portfolio/backend/dto/response/ArticleResponse.java`
- Modify: `backend/src/main/java/com/portfolio/backend/mapper/ArticleMapper.java`
- Modify: `backend/src/main/java/com/portfolio/backend/service/ArticleService.java`
- Modify: `backend/src/test/java/com/portfolio/backend/service/ArticleServiceTest.java`

**Interfaces:**
- Consumes: `ArticleContentType` (Tâche 1).
- Produces: `ArticleRequest(title, summary, content, contentType, coverImageUrl, tags, status)`, `ArticleResponse(id, title, slug, summary, content, contentType, coverImageUrl, tags, status, publishedAt, authorName, createdAt, updatedAt)` — ces signatures positionnelles sont consommées par `ArticleControllerTest` (Tâche 3).

Ces deux records étant positionnels, ce changement casse la compilation de tous les call sites existants tant qu'ils ne sont pas mis à jour dans la même tâche — c'est attendu (le "RED" ici est une erreur de compilation, pas un test qui échoue).

- [ ] **Step 1: Ajouter `contentType` à `ArticleRequest`**

```java
package com.portfolio.backend.dto.request;

import com.portfolio.backend.entity.ArticleContentType;
import com.portfolio.backend.entity.ArticleStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.validator.constraints.URL;

import java.util.List;

public record ArticleRequest(
    @NotBlank(message = "Le titre est obligatoire")
    @Size(min = 2, max = 200, message = "Le titre doit contenir entre 2 et 200 caractères")
    String title,

    @Size(max = 500, message = "Le résumé ne peut pas dépasser 500 caractères")
    String summary,

    @NotBlank(message = "Le contenu est obligatoire")
    String content,

    @NotNull(message = "Le type de contenu est obligatoire")
    ArticleContentType contentType,

    @URL(message = "L'URL doit commencer par http:// ou https://")
    String coverImageUrl,

    List<String> tags,

    @NotNull(message = "Le statut est obligatoire")
    ArticleStatus status
) {
}
```

- [ ] **Step 2: Ajouter `contentType` à `ArticleResponse`**

```java
package com.portfolio.backend.dto.response;

import com.portfolio.backend.entity.ArticleContentType;
import com.portfolio.backend.entity.ArticleStatus;

import java.time.LocalDateTime;
import java.util.List;

public record ArticleResponse(
    Long id,
    String title,
    String slug,
    String summary,
    String content,
    ArticleContentType contentType,
    String coverImageUrl,
    List<String> tags,
    ArticleStatus status,
    LocalDateTime publishedAt,
    String authorName,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
```

- [ ] **Step 3: Mettre à jour `ArticleMapper`**

```java
    public ArticleResponse toResponse(Article article) {
        return new ArticleResponse(
            article.getId(),
            article.getTitle(),
            article.getSlug(),
            article.getSummary(),
            article.getContent(),
            article.getContentType(),
            article.getCoverImageUrl(),
            article.getTags(),
            article.getStatus(),
            article.getPublishedAt(),
            article.getUser().getFirstName() + " " + article.getUser().getLastName(),
            article.getCreatedAt(),
            article.getUpdatedAt()
        );
    }
```

- [ ] **Step 4: Mettre à jour `ArticleService.createArticle` et `updateArticle`**

Dans `createArticle`, ajouter `.contentType(request.contentType())` au builder :

```java
        Article article = Article.builder()
            .title(request.title())
            .slug(slug)
            .summary(request.summary())
            .content(request.content())
            .contentType(request.contentType())
            .coverImageUrl(request.coverImageUrl())
            .tags(request.tags() != null ? new ArrayList<>(request.tags()) : new ArrayList<>())
            .status(request.status())
            .publishedAt(request.status() == ArticleStatus.PUBLISHED ? LocalDateTime.now() : null)
            .user(currentUser)
            .build();
```

Dans `updateArticle`, ajouter le setter juste après `setContent` :

```java
        article.setTitle(request.title());
        article.setSummary(request.summary());
        article.setContent(request.content());
        article.setContentType(request.contentType());
        article.setCoverImageUrl(request.coverImageUrl());
```

- [ ] **Step 5: Run backend tests pour constater l'échec de compilation**

Run: `cd backend && ./mvnw test -DskipITs`
Expected: FAIL (compilation error dans `ArticleServiceTest.java` — `ArticleRequest`/`ArticleResponse` attendent maintenant 7/13 arguments).

- [ ] **Step 6: Mettre à jour tous les call sites dans `ArticleServiceTest.java`**

Ajouter l'import :

```java
import com.portfolio.backend.entity.ArticleContentType;
```

Mettre à jour `testArticleResponse` dans `setUp()` :

```java
        testArticleResponse = new ArticleResponse(
            1L, "Mon article", "mon-article", null, "Contenu Markdown", ArticleContentType.MARKDOWN, null,
            List.of(), ArticleStatus.DRAFT, null, "Amine Charrad", null, null
        );
```

Mettre à jour chacun des 6 appels `new ArticleRequest(...)` en insérant `ArticleContentType.MARKDOWN` juste après le paramètre `content` :

```java
            ArticleRequest request = new ArticleRequest(
                "Découvrir Kubernetes & l'Auto-scaling", null, "Contenu", ArticleContentType.MARKDOWN, null, List.of(), ArticleStatus.DRAFT
            );
```
```java
            ArticleRequest request = new ArticleRequest(
                "Mon article", null, "Contenu", ArticleContentType.MARKDOWN, null, List.of(), ArticleStatus.DRAFT
            );
```
```java
            ArticleRequest request = new ArticleRequest(
                "Article publié", null, "Contenu", ArticleContentType.MARKDOWN, null, List.of(), ArticleStatus.PUBLISHED
            );
```
```java
            ArticleRequest request = new ArticleRequest(
                "Brouillon", null, "Contenu", ArticleContentType.MARKDOWN, null, List.of(), ArticleStatus.DRAFT
            );
```
```java
            ArticleRequest request = new ArticleRequest(
                "Mon article", null, "Contenu modifié", ArticleContentType.MARKDOWN, null, List.of(), ArticleStatus.PUBLISHED
            );
```
```java
            ArticleRequest request = new ArticleRequest(
                "Mon article modifié", null, "Contenu modifié", ArticleContentType.MARKDOWN, null, List.of(), ArticleStatus.PUBLISHED
            );
```

- [ ] **Step 7: Ajouter un test de round-trip `contentType` (nouveau `@Nested`)**

Ajouter cette classe dans `ArticleServiceTest.java`, après `PublishedAtTests` :

```java
    @Nested
    @DisplayName("contentType — round-trip create/update")
    class ContentTypeTests {

        @Test
        @DisplayName("Persiste contentType=HTML à la création")
        void shouldPersistHtmlContentTypeOnCreate() {
            ArticleRequest request = new ArticleRequest(
                "Article designé", null, "<html><body>...</body></html>", ArticleContentType.HTML,
                null, List.of(), ArticleStatus.DRAFT
            );
            given(articleRepository.existsBySlug(any())).willReturn(false);
            given(articleRepository.save(any(Article.class))).willReturn(testArticle);
            given(articleMapper.toResponse(testArticle)).willReturn(testArticleResponse);

            articleService.createArticle(request);

            ArgumentCaptor<Article> captor = ArgumentCaptor.forClass(Article.class);
            verify(articleRepository).save(captor.capture());
            assertThat(captor.getValue().getContentType()).isEqualTo(ArticleContentType.HTML);
        }

        @Test
        @DisplayName("Met à jour contentType de MARKDOWN vers HTML")
        void shouldUpdateContentTypeToHtml() {
            testArticle.setContentType(ArticleContentType.MARKDOWN);
            ArticleRequest request = new ArticleRequest(
                "Mon article", null, "<html><body>...</body></html>", ArticleContentType.HTML,
                null, List.of(), ArticleStatus.DRAFT
            );
            given(articleRepository.findById(1L)).willReturn(Optional.of(testArticle));
            given(articleRepository.save(any(Article.class))).willReturn(testArticle);
            given(articleMapper.toResponse(testArticle)).willReturn(testArticleResponse);

            articleService.updateArticle(1L, request);

            assertThat(testArticle.getContentType()).isEqualTo(ArticleContentType.HTML);
        }
    }
```

- [ ] **Step 8: Run tests pour vérifier que tout passe**

Run: `cd backend && ./mvnw test -DskipITs`
Expected: PASS (tous les tests `ArticleServiceTest`, y compris les 2 nouveaux).

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/java/com/portfolio/backend/dto/request/ArticleRequest.java backend/src/main/java/com/portfolio/backend/dto/response/ArticleResponse.java backend/src/main/java/com/portfolio/backend/mapper/ArticleMapper.java backend/src/main/java/com/portfolio/backend/service/ArticleService.java backend/src/test/java/com/portfolio/backend/service/ArticleServiceTest.java
git commit -m "feat(backend): propage contentType dans les DTOs, le mapper et le service Article"
```

---

### Tâche 3 : `ArticleControllerTest` — mise à jour + test de transit JSON

**Files:**
- Modify: `backend/src/test/java/com/portfolio/backend/controller/ArticleControllerTest.java`

**Interfaces:**
- Consumes: `ArticleRequest`/`ArticleResponse` signatures de la Tâche 2.

- [ ] **Step 1: Run les tests contrôleur pour constater l'échec de compilation**

Run: `cd backend && ./mvnw test -Dtest=ArticleControllerTest -DskipITs`
Expected: FAIL (compilation error — signatures `ArticleRequest`/`ArticleResponse` obsolètes).

- [ ] **Step 2: Ajouter l'import et mettre à jour tous les call sites**

Ajouter :

```java
import com.portfolio.backend.entity.ArticleContentType;
```

Mettre à jour `sampleArticle` :

```java
    private final ArticleResponse sampleArticle = new ArticleResponse(
        1L, "Mon article", "mon-article", "Résumé", "Contenu Markdown", ArticleContentType.MARKDOWN, null,
        List.of("kubernetes"), ArticleStatus.PUBLISHED, null, "Amine Charrad", null, null
    );
```

Mettre à jour les 4 appels `new ArticleRequest(...)` dans `AdminWriteEndpointsTests` :

```java
            ArticleRequest request = new ArticleRequest(
                "Test", null, "Contenu suffisant", ArticleContentType.MARKDOWN, null, List.of(), ArticleStatus.DRAFT
            );
```
```java
            ArticleRequest request = new ArticleRequest(
                "Mon article", "Résumé", "Contenu Markdown", ArticleContentType.MARKDOWN, null, List.of("kubernetes"), ArticleStatus.DRAFT
            );
```
```java
            ArticleRequest invalidRequest = new ArticleRequest(
                "", null, "Contenu suffisant", ArticleContentType.MARKDOWN, null, List.of(), ArticleStatus.DRAFT
            );
```
```java
            ArticleRequest request = new ArticleRequest(
                "Mon article modifié", "Résumé", "Contenu modifié", ArticleContentType.MARKDOWN, null, List.of(), ArticleStatus.PUBLISHED
            );
```

- [ ] **Step 3: Ajouter un test vérifiant que `contentType` transite dans le JSON**

Ajouter dans `AdminWriteEndpointsTests`, après `shouldReturn201WithAdminRole` :

```java
        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("POST /articles transmet et retourne contentType=HTML")
        void shouldRoundTripHtmlContentType() throws Exception {
            ArticleRequest request = new ArticleRequest(
                "Article designé", "Résumé", "<html><body>...</body></html>", ArticleContentType.HTML,
                null, List.of(), ArticleStatus.DRAFT
            );
            ArticleResponse htmlResponse = new ArticleResponse(
                2L, "Article designé", "article-designe", "Résumé", "<html><body>...</body></html>",
                ArticleContentType.HTML, null, List.of(), ArticleStatus.DRAFT, null, "Amine Charrad", null, null
            );
            given(articleService.createArticle(any(ArticleRequest.class))).willReturn(htmlResponse);

            mockMvc.perform(post("/articles")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.contentType").value("HTML"));
        }
```

- [ ] **Step 4: Run tests pour vérifier que tout passe**

Run: `cd backend && ./mvnw test -Dtest=ArticleControllerTest -DskipITs`
Expected: PASS.

- [ ] **Step 5: Run la suite backend complète**

Run: `cd backend && ./mvnw test -DskipITs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/test/java/com/portfolio/backend/controller/ArticleControllerTest.java
git commit -m "test(backend): couvre le transit JSON de contentType sur ArticleController"
```

---

## Frontend

### Tâche 4 : Modèle TypeScript `article.model.ts`

**Files:**
- Modify: `frontend/src/app/shared/models/article.model.ts`

**Interfaces:**
- Produces: `ArticleContentType = 'MARKDOWN' | 'HTML'`, `Article.contentType`, `ArticleFormData.contentType`.

- [ ] **Step 1: Ajouter le type et les champs**

```ts
export type ArticleStatus = 'DRAFT' | 'PUBLISHED';
export type ArticleContentType = 'MARKDOWN' | 'HTML';

/**
 * Modèle article — miroir de ArticleResponse Java.
 * readonly : les données reçues de l'API ne doivent pas être mutées directement.
 */
export interface Article {
  readonly id: number;
  readonly title: string;
  readonly slug: string;
  readonly summary?: string;
  readonly content: string;
  readonly contentType: ArticleContentType;
  readonly coverImageUrl?: string;
  readonly tags: string[];
  readonly status: ArticleStatus;
  readonly publishedAt?: string;
  readonly authorName: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Payload pour créer ou modifier un article — miroir de ArticleRequest Java.
 * Mutable car c'est le formulaire de saisie.
 */
export interface ArticleFormData {
  title: string;
  summary?: string;
  content: string;
  contentType: ArticleContentType;
  coverImageUrl?: string;
  tags: string[];
  status: ArticleStatus;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/shared/models/article.model.ts
git commit -m "feat(frontend): ajoute ArticleContentType au modèle Article"
```

(Ce changement casse volontairement la compilation des fixtures `mockArticle` existantes — corrigé en Tâche 5.)

---

### Tâche 5 : Corriger les fixtures `mockArticle` existantes

**Files:**
- Modify: `frontend/src/app/features/portfolio/blog/blog-detail/blog-detail.component.spec.ts`
- Modify: `frontend/src/app/features/admin/article-form/article-form.component.spec.ts`

**Interfaces:**
- Consumes: `Article.contentType` (Tâche 4).

- [ ] **Step 1: Run les tests frontend pour constater l'échec de compilation**

Run: `cd frontend && npx jest blog-detail article-form`
Expected: FAIL (TypeScript : `contentType` manquant sur les objets `mockArticle`).

- [ ] **Step 2: Ajouter `contentType: 'MARKDOWN'` à `mockArticle` dans `blog-detail.component.spec.ts`**

```ts
  const mockArticle: Article = {
    id: 1,
    title: 'Mon article',
    slug: 'mon-article',
    summary: 'Résumé',
    content: '# Titre\n\nContenu **gras** et `code`.',
    contentType: 'MARKDOWN',
    coverImageUrl: undefined,
    tags: ['kubernetes'],
    status: 'PUBLISHED',
    publishedAt: '2026-08-09T10:00:00',
    authorName: 'Amine Charrad',
    createdAt: '',
    updatedAt: '',
  };
```

- [ ] **Step 3: Ajouter `contentType: 'MARKDOWN'` à `mockArticle` dans `article-form.component.spec.ts`**

```ts
  const mockArticle: Article = {
    id: 1,
    title: 'Mon article',
    slug: 'mon-article',
    summary: 'Résumé',
    content: 'Contenu Markdown',
    contentType: 'MARKDOWN',
    coverImageUrl: undefined,
    tags: ['kubernetes'],
    status: 'DRAFT',
    publishedAt: undefined,
    authorName: 'Amine Charrad',
    createdAt: '',
    updatedAt: '',
  };
```

- [ ] **Step 4: Run les tests pour vérifier que tout passe**

Run: `cd frontend && npx jest blog-detail article-form`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/portfolio/blog/blog-detail/blog-detail.component.spec.ts frontend/src/app/features/admin/article-form/article-form.component.spec.ts
git commit -m "test(frontend): ajoute contentType aux fixtures mockArticle"
```

---

### Tâche 6 : Composant `RichHtmlArticleComponent`

**Files:**
- Create: `frontend/src/app/shared/components/rich-html-article/rich-html-article.component.ts`
- Create: `frontend/src/app/shared/components/rich-html-article/rich-html-article.component.spec.ts`

**Interfaces:**
- Consumes: rien (composant autonome).
- Produces: sélecteur `app-rich-html-article`, `@Input() content: string`. Consommé par `blog-detail.component.ts` (Tâche 7) et `article-form.component.ts` (Tâche 8).

Notes d'implémentation importantes (vues en examinant `articles/circuit-breaker-resilience4j.html`) :
- Les `<link rel="preconnect">` de Google Fonts n'ont **pas** de `/` final dans leur `href` (ex. `href="https://fonts.gstatic.com"`). La comparaison de whitelist doit se faire sur `new URL(href).origin`, pas sur un `startsWith` avec slash final.
- Le hook DOMPurify est enregistré sur une **instance isolée** (`createDOMPurify(window)`), pas sur l'import par défaut de `dompurify` utilisé ailleurs (`blog-detail`, `article-form` pour le rendu Markdown) — pour ne jamais polluer globalement le pipeline Markdown existant avec des hooks propres au HTML designé.

- [ ] **Step 1: Écrire le test d'extraction du body**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RichHtmlArticleComponent } from './rich-html-article.component';

describe('RichHtmlArticleComponent', () => {
  let fixture: ComponentFixture<RichHtmlArticleComponent>;
  let component: RichHtmlArticleComponent;

  function shadowRoot(): ShadowRoot {
    const host = fixture.nativeElement.querySelector('.rich-html-article-host') as HTMLDivElement;
    return host.shadowRoot!;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RichHtmlArticleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RichHtmlArticleComponent);
    component = fixture.componentInstance;
  });

  it('should extract the body content and inject it into the shadow root, not the light DOM', () => {
    component.content = '<html><head></head><body><h1>Titre</h1></body></html>';
    fixture.detectChanges();

    expect(shadowRoot().innerHTML).toContain('<h1>Titre</h1>');
    expect(fixture.nativeElement.querySelector('h1')).toBeNull();
  });
});
```

- [ ] **Step 2: Run pour vérifier l'échec**

Run: `cd frontend && npx jest rich-html-article`
Expected: FAIL (module `./rich-html-article.component` introuvable).

- [ ] **Step 3: Implémenter le composant**

```ts
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import createDOMPurify from 'dompurify';

const ALLOWED_FONT_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

const RICH_HTML_SANITIZE_CONFIG = {
  ADD_TAGS: ['style', 'link'],
  ADD_ATTR: ['rel', 'href', 'crossorigin'],
};

function isAllowedFontOrigin(href: string | null): boolean {
  if (!href) {
    return false;
  }
  try {
    return ALLOWED_FONT_ORIGINS.includes(new URL(href).origin);
  } catch {
    return false;
  }
}

const purifier = createDOMPurify(window);
purifier.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'LINK' && !isAllowedFontOrigin(node.getAttribute('href'))) {
    node.remove();
  }
});

/**
 * Rend un article "HTML designé" (document HTML autonome collé tel quel,
 * avec son propre <style> et ses polices Google Fonts) en isolant son CSS
 * du reste du site via un Shadow DOM natif.
 */
@Component({
  selector: 'app-rich-html-article',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #host class="rich-html-article-host"></div>`,
})
export class RichHtmlArticleComponent implements AfterViewInit, OnChanges {
  @Input() content = '';

  @ViewChild('host', { static: true }) private hostRef!: ElementRef<HTMLDivElement>;

  private shadowRoot: ShadowRoot | null = null;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['content'] && this.viewReady) {
      this.render();
    }
  }

  private render(): void {
    if (!this.shadowRoot) {
      this.shadowRoot = this.hostRef.nativeElement.attachShadow({ mode: 'open' });
    }
    this.shadowRoot.innerHTML = this.buildSanitizedMarkup(this.content);
  }

  private buildSanitizedMarkup(rawDocument: string): string {
    const parsed = new DOMParser().parseFromString(rawDocument, 'text/html');

    const links = Array.from(parsed.querySelectorAll('link'))
      .filter((link) => isAllowedFontOrigin(link.getAttribute('href')))
      .map((link) => link.outerHTML)
      .join('\n');

    const style = Array.from(parsed.querySelectorAll('style'))
      .map((el) => this.rewriteRootToHost(el.textContent ?? ''))
      .join('\n');

    const body = parsed.body?.innerHTML ?? '';

    const combined = `${links}\n<style>${style}</style>\n${body}`;

    return purifier.sanitize(combined, RICH_HTML_SANITIZE_CONFIG);
  }

  private rewriteRootToHost(css: string): string {
    return css.replace(/:root\b/g, ':host');
  }
}
```

- [ ] **Step 4: Run pour vérifier que le premier test passe**

Run: `cd frontend && npx jest rich-html-article`
Expected: PASS.

- [ ] **Step 5: Écrire les tests restants (réécriture CSS, whitelist polices, XSS, ré-rendu)**

Ajouter à la suite du fichier `.spec.ts` :

```ts
  it('should extract style text and rewrite :root to :host', () => {
    component.content =
      '<html><head><style>:root{--ink:#111;} h2{color:red;}</style></head><body><p>Texte</p></body></html>';
    fixture.detectChanges();

    const styleTag = shadowRoot().querySelector('style');
    expect(styleTag?.textContent).toContain(':host{--ink:#111;}');
    expect(styleTag?.textContent).not.toContain(':root');
  });

  it('should keep whitelisted Google Fonts links (including bare-origin preconnect hrefs) and drop others', () => {
    component.content = `
      <html><head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
        <link rel="stylesheet" href="https://evil.example/x.css">
      </head><body><p>Texte</p></body></html>
    `;
    fixture.detectChanges();

    const hrefs = Array.from(shadowRoot().querySelectorAll('link')).map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('https://fonts.gstatic.com');
    expect(hrefs.some((h) => h?.startsWith('https://fonts.googleapis.com'))).toBe(true);
    expect(hrefs.some((h) => h?.includes('evil.example'))).toBe(false);
  });

  it('should strip <script> tags (XSS)', () => {
    component.content = '<html><body><script>alert(1)</script><p>Texte sûr</p></body></html>';
    fixture.detectChanges();

    expect(shadowRoot().innerHTML).not.toContain('<script');
    expect(shadowRoot().innerHTML).toContain('Texte sûr');
  });

  it('should strip on* event handler attributes (XSS)', () => {
    component.content = '<html><body><img src="x.png" onerror="alert(1)"></body></html>';
    fixture.detectChanges();

    expect(shadowRoot().innerHTML).not.toContain('onerror');
  });

  it('should strip javascript: URLs (XSS)', () => {
    component.content = '<html><body><a href="javascript:alert(1)">Lien</a></body></html>';
    fixture.detectChanges();

    expect(shadowRoot().innerHTML).not.toContain('javascript:');
  });

  it('should re-render into the shadow root when content changes', () => {
    component.content = '<html><body><p>Premier</p></body></html>';
    fixture.detectChanges();
    expect(shadowRoot().innerHTML).toContain('Premier');

    component.content = '<html><body><p>Second</p></body></html>';
    component.ngOnChanges({
      content: {
        currentValue: component.content,
        previousValue: '',
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    expect(shadowRoot().innerHTML).toContain('Second');
    expect(shadowRoot().innerHTML).not.toContain('Premier');
  });
```

- [ ] **Step 6: Run pour vérifier que tous les tests passent**

Run: `cd frontend && npx jest rich-html-article`
Expected: PASS (7 tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/shared/components/rich-html-article/
git commit -m "feat(frontend): ajoute RichHtmlArticleComponent (rendu HTML designé en Shadow DOM)"
```

---

### Tâche 7 : Intégration dans `blog-detail.component.ts`

**Files:**
- Modify: `frontend/src/app/features/portfolio/blog/blog-detail/blog-detail.component.ts`
- Modify: `frontend/src/app/features/portfolio/blog/blog-detail/blog-detail.component.spec.ts`

**Interfaces:**
- Consumes: `RichHtmlArticleComponent` (Tâche 6), `Article.contentType` (Tâche 4).

- [ ] **Step 1: Écrire le test de bascule HTML avant l'implémentation**

Ajouter dans `blog-detail.component.spec.ts` :

```ts
  it('should render app-rich-html-article when contentType is HTML', () => {
    mockArticleService.getArticleBySlug.mockReturnValue(
      of({ ...mockArticle, contentType: 'HTML', content: '<html><body><p>Design</p></body></html>' })
    );

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-rich-html-article')).toBeTruthy();
  });
```

- [ ] **Step 2: Run pour vérifier l'échec**

Run: `cd frontend && npx jest blog-detail`
Expected: FAIL (`app-rich-html-article` absent du DOM — pas encore branché dans le template).

- [ ] **Step 3: Importer le composant et brancher la bascule conditionnelle**

Ajouter l'import :

```ts
import { RichHtmlArticleComponent } from '@shared/components/rich-html-article/rich-html-article.component';
```

Ajouter `RichHtmlArticleComponent` au tableau `imports` du `@Component` :

```ts
  imports: [RouterLink, LoadingSpinnerComponent, TranslatePipe, RichHtmlArticleComponent],
```

Remplacer la ligne `<div class="bd-content" [innerHTML]="renderedHtml()"></div>` par :

```html
          @if (article()!.contentType === 'HTML') {
            <app-rich-html-article [content]="article()!.content" />
          } @else {
            <div class="bd-content" [innerHTML]="renderedHtml()"></div>
          }
```

- [ ] **Step 4: Run pour vérifier que le test passe**

Run: `cd frontend && npx jest blog-detail`
Expected: PASS (tous les tests, y compris les existants — le rendu Markdown n'est pas affecté).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/portfolio/blog/blog-detail/blog-detail.component.ts frontend/src/app/features/portfolio/blog/blog-detail/blog-detail.component.spec.ts
git commit -m "feat(frontend): blog-detail bascule vers RichHtmlArticleComponent pour contentType=HTML"
```

---

### Tâche 8 : Bascule de mode dans `article-form.component.ts`

**Files:**
- Modify: `frontend/src/app/features/admin/article-form/article-form.component.ts`
- Modify: `frontend/src/app/features/admin/article-form/article-form.component.spec.ts`

**Interfaces:**
- Consumes: `RichHtmlArticleComponent` (Tâche 6), `ArticleContentType` (Tâche 4).

- [ ] **Step 1: Écrire les tests avant l'implémentation**

Ajouter dans `article-form.component.spec.ts` :

```ts
  it('should default contentType to MARKDOWN for a new article', () => {
    fixture.detectChanges();

    expect(component['form'].get('contentType')?.value).toBe('MARKDOWN');
  });

  it('should patch contentType and show the rich HTML preview for an existing HTML article', () => {
    mockArticleService.getArticleByIdForAdmin.mockReturnValue(
      of({ ...mockArticle, contentType: 'HTML', content: '<html><body><p>Design</p></body></html>' })
    );
    component.id = '1';

    fixture.detectChanges();

    expect(component['form'].get('contentType')?.value).toBe('HTML');
    expect(fixture.nativeElement.querySelector('app-rich-html-article')).toBeTruthy();
  });
```

- [ ] **Step 2: Run pour vérifier l'échec**

Run: `cd frontend && npx jest article-form`
Expected: FAIL (`form.get('contentType')` est `null`, `app-rich-html-article` absent).

- [ ] **Step 3: Ajouter les imports nécessaires**

```ts
import { MatButtonToggleModule } from '@angular/material/button-toggle';

import { RichHtmlArticleComponent } from '@shared/components/rich-html-article/rich-html-article.component';
import { ArticleContentType, ArticleStatus } from '@shared/models/article.model';
```

Ajouter `MatButtonToggleModule` et `RichHtmlArticleComponent` au tableau `imports` du `@Component`.

- [ ] **Step 4: Ajouter le contrôle réactif `contentType`**

```ts
  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    summary: ['', [Validators.maxLength(500)]],
    coverImageUrl: ['', [Validators.pattern(URL_PATTERN)]],
    content: ['', [Validators.required]],
    contentType: ['MARKDOWN' as ArticleContentType],
    status: ['DRAFT' as ArticleStatus],
  });
```

- [ ] **Step 5: Patcher `contentType` au chargement d'un article existant**

Dans `ngOnInit()` :

```ts
        this.form.patchValue({
          title: a.title,
          summary: a.summary ?? '',
          coverImageUrl: a.coverImageUrl ?? '',
          content: a.content,
          contentType: a.contentType,
          status: a.status,
        });
```

- [ ] **Step 6: Inclure `contentType` dans le payload de soumission**

Dans `onSubmit()` :

```ts
    const data = {
      title: this.form.value.title!,
      summary: this.form.value.summary || undefined,
      coverImageUrl: this.form.value.coverImageUrl || undefined,
      content: this.form.value.content!,
      contentType: this.form.value.contentType as ArticleContentType,
      tags: this.tags(),
      status: this.form.value.status as ArticleStatus,
    };
```

- [ ] **Step 7: Ajouter le toggle et la bascule de l'aperçu dans le template**

Insérer ce bloc juste avant `<div class="content-section">` :

```html
          <div class="content-type-toggle">
            <p class="tags-label">{{ 'admin.form.field.contentType' | translate }}</p>
            <mat-button-toggle-group formControlName="contentType" aria-label="Type de contenu">
              <mat-button-toggle value="MARKDOWN">{{
                'admin.form.field.contentType.markdown' | translate
              }}</mat-button-toggle>
              <mat-button-toggle value="HTML">{{
                'admin.form.field.contentType.html' | translate
              }}</mat-button-toggle>
            </mat-button-toggle-group>
          </div>
```

Remplacer le contenu de `.content-preview` :

```html
            <div class="content-preview">
              <p class="tags-label">{{ 'admin.form.preview' | translate }}</p>
              @if (form.value.contentType === 'HTML') {
                <app-rich-html-article [content]="form.value.content ?? ''" />
              } @else {
                <div class="content-preview__body" [innerHTML]="previewHtml()"></div>
              }
            </div>
```

- [ ] **Step 8: Ajouter le style du nouveau bloc**

Ajouter dans le tableau `styles`, après `.tags-section` :

```css
      .content-type-toggle {
        margin: 0.5rem 0;
      }
```

- [ ] **Step 9: Run pour vérifier que tout passe**

Run: `cd frontend && npx jest article-form`
Expected: PASS (tous les tests, y compris les 2 nouveaux et les existants).

- [ ] **Step 10: Commit**

```bash
git add frontend/src/app/features/admin/article-form/article-form.component.ts frontend/src/app/features/admin/article-form/article-form.component.spec.ts
git commit -m "feat(frontend): ajoute la bascule Markdown/HTML designé au formulaire d'article"
```

---

### Tâche 9 : Clés i18n

**Files:**
- Modify: `frontend/src/assets/i18n/fr.json`
- Modify: `frontend/src/assets/i18n/en.json`
- Modify: `frontend/src/assets/i18n/de.json`

**Interfaces:**
- Produces: `admin.form.field.contentType`, `admin.form.field.contentType.markdown`, `admin.form.field.contentType.html` — consommées par le template de la Tâche 8.

- [ ] **Step 1: Ajouter les clés dans `fr.json`**

Juste avant `"admin.form.field.content": "Contenu (Markdown) *",` (ligne 226) :

```json
  "admin.form.field.contentType": "Type de contenu",
  "admin.form.field.contentType.markdown": "Markdown",
  "admin.form.field.contentType.html": "HTML designé",
```

- [ ] **Step 2: Ajouter les clés dans `en.json`**

Juste avant `"admin.form.field.content": "Content (Markdown) *",` (ligne 211) :

```json
  "admin.form.field.contentType": "Content type",
  "admin.form.field.contentType.markdown": "Markdown",
  "admin.form.field.contentType.html": "Designed HTML",
```

- [ ] **Step 3: Ajouter les clés dans `de.json`**

Juste avant `"admin.form.field.content": "Inhalt (Markdown) *",` (ligne 211) :

```json
  "admin.form.field.contentType": "Inhaltstyp",
  "admin.form.field.contentType.markdown": "Markdown",
  "admin.form.field.contentType.html": "Gestaltetes HTML",
```

- [ ] **Step 4: Vérifier la validité JSON des 3 fichiers**

Run: `cd frontend && node -e "['fr','en','de'].forEach(l => JSON.parse(require('fs').readFileSync('src/assets/i18n/'+l+'.json','utf8')))"`
Expected: aucune erreur (pas de sortie = succès).

- [ ] **Step 5: Run la suite frontend complète pour vérifier l'absence de régression**

Run: `cd frontend && npx jest`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/assets/i18n/fr.json frontend/src/assets/i18n/en.json frontend/src/assets/i18n/de.json
git commit -m "i18n: ajoute les clés du toggle de type de contenu (fr/en/de)"
```

---

### Tâche 10 : CSP — whitelist Google Fonts

**Files:**
- Modify: `frontend/nginx.conf`

**Interfaces:** aucune (configuration serveur uniquement).

- [ ] **Step 1: Modifier la ligne `set $csp`**

Remplacer (ligne 79) :

```
    set $csp "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'";
```

par :

```
    set $csp "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https: data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'";
```

(Cette variable est référencée 3 fois via `add_header Content-Security-Policy-Report-Only $csp always;` — une seule édition suffit.)

- [ ] **Step 2: Vérifier la syntaxe nginx**

Run: `docker run --rm -v "$(pwd)/frontend/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:alpine nginx -t`
Expected: `syntax is ok` / `test is successful` (si Docker n'est pas disponible localement, relire attentivement le diff à la place — un seul token ajouté à deux directives existantes, risque de faute de syntaxe minimal).

- [ ] **Step 3: Commit**

```bash
git add frontend/nginx.conf
git commit -m "chore(nginx): autorise Google Fonts dans la CSP pour les articles HTML designés"
```

---

### Tâche 11 : Validation manuelle locale (checkpoint obligatoire avant push)

Pas de commit de code dans cette tâche — c'est un point de contrôle humain. Rappel : ne jamais pousser un changement visuel sans validation locale par l'utilisateur (contrainte déjà appliquée sur ce projet).

- [ ] **Step 1: Démarrer le backend en local**

Run: `cd backend && ./mvnw spring-boot:run` (profil `localdev`, cf. `application-localdev.properties`)

- [ ] **Step 2: Démarrer le frontend en local**

Run: `cd frontend && npm start`

- [ ] **Step 3: Se connecter en admin et créer un nouvel article en mode "HTML designé"**

Dans `/admin`, créer un article, basculer le toggle sur "HTML designé", coller le contenu intégral de `articles/circuit-breaker-resilience4j.html` dans le champ contenu, vérifier que l'aperçu affiche le design (hero, typographie custom, schémas SVG) correctement isolé du reste de la page admin. Passer le statut à "Publié" et enregistrer.

- [ ] **Step 4: Vérifier le rendu public**

Naviguer vers `/portfolio/blog`, ouvrir l'article publié, vérifier dans les DevTools que :
- le `<div class="rich-html-article-host">` a un `shadowRoot` non nul contenant le design complet ;
- aucune règle CSS de l'article (ex. `body{...}`, `h2{...}`) ne fuite sur la navbar/footer du site ;
- la console ne montre aucune violation CSP `Report-Only` liée aux polices Google Fonts.

- [ ] **Step 5: Demander la validation explicite de l'utilisateur**

Ne pousser sur `main` qu'après un accord explicite de l'utilisateur sur le rendu observé en local.

---

## Auto-révision (à faire après rédaction, avant remise à l'utilisateur)

- **Couverture spec** : migration + entité + enum (§Backend/Migration, §Entité) → Tâche 1. DTO/Mapper (§DTO/Mapper) → Tâche 2. Tests backend (§Tests backend) → Tâches 2-3. Modèle TS (§Modèle) → Tâche 4. `RichHtmlArticleComponent` avec ses 6 responsabilités (§Composant partagé) → Tâche 6. `blog-detail` (§blog-detail.component.ts) → Tâche 7. `article-form` (§article-form.component.ts) → Tâche 8. CSP (§CSP) → Tâche 10. Tests frontend (§Tests frontend) → Tâches 5-8. Aucune nouvelle dépendance (§Nouvelles dépendances) → respecté (aucun `npm install`/`pom.xml` dans le plan). Hors scope (§Hors scope) → aucune tâche n'implémente import de fichier, WYSIWYG, rétro-conversion, iframe, ou whitelist configurable — conforme.
- **Placeholders** : aucun "TBD"/"TODO" ; chaque step contient du code exact ou une commande exacte.
- **Cohérence des types/signatures** : `ArticleContentType` (backend) et `ArticleContentType` (frontend) ont les mêmes valeurs littérales `MARKDOWN`/`HTML` utilisées identiquement dans toutes les tâches. `RichHtmlArticleComponent.content` (Tâche 6) correspond à `[content]="article()!.content"` (Tâche 7) et `[content]="form.value.content ?? ''"` (Tâche 8). Ordre de champ `contentType` juste après `content` respecté dans l'entité (Tâche 1), `ArticleRequest`/`ArticleResponse` (Tâche 2), et le modèle TS (Tâche 4).
