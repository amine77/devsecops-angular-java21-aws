package com.portfolio.backend.controller;

import com.portfolio.backend.dto.request.ArticleRequest;
import com.portfolio.backend.dto.response.ApiResponse;
import com.portfolio.backend.dto.response.ArticleResponse;
import com.portfolio.backend.dto.response.PageResponse;
import com.portfolio.backend.service.ArticleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/articles")
@Tag(name = "Articles", description = "Gestion des articles du blog")
public class ArticleController {

    private final ArticleService articleService;

    public ArticleController(ArticleService articleService) {
        this.articleService = articleService;
    }

    @GetMapping
    @Operation(summary = "Liste des articles publiés",
        description = "Retourne la liste paginée des articles PUBLISHED, filtrable par tag")
    public ResponseEntity<ApiResponse<PageResponse<ArticleResponse>>> getPublishedArticles(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @Parameter(description = "Filtre par tag (optionnel)")
        @RequestParam(required = false) String tag
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "publishedAt"));
        return ResponseEntity.ok(ApiResponse.success(articleService.getPublished(pageable, tag)));
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Liste de tous les articles (admin)", security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<ApiResponse<PageResponse<ArticleResponse>>> getAllArticlesForAdmin(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "50") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(ApiResponse.success(articleService.getAllForAdmin(pageable)));
    }

    @GetMapping("/admin/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Détail d'un article quel que soit son statut (admin)",
        security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<ApiResponse<ArticleResponse>> getArticleByIdForAdmin(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(articleService.getByIdForAdmin(id)));
    }

    @GetMapping("/{slug}")
    @Operation(summary = "Détail d'un article publié par son slug")
    public ResponseEntity<ApiResponse<ArticleResponse>> getPublishedArticleBySlug(@PathVariable String slug) {
        return ResponseEntity.ok(ApiResponse.success(articleService.getPublishedBySlug(slug)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Créer un article", security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<ApiResponse<ArticleResponse>> createArticle(@Valid @RequestBody ArticleRequest request) {
        ArticleResponse created = articleService.createArticle(request);
        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(ApiResponse.success(created, "Article créé avec succès"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Modifier un article", security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<ApiResponse<ArticleResponse>> updateArticle(
        @PathVariable Long id,
        @Valid @RequestBody ArticleRequest request
    ) {
        return ResponseEntity.ok(
            ApiResponse.success(articleService.updateArticle(id, request), "Article mis à jour")
        );
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Supprimer un article", security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<Void> deleteArticle(@PathVariable Long id) {
        articleService.deleteArticle(id);
        return ResponseEntity.noContent().build();
    }
}
