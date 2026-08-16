package com.portfolio.backend.service;

import com.portfolio.backend.dto.request.ArticleRequest;
import com.portfolio.backend.dto.response.ArticleResponse;
import com.portfolio.backend.dto.response.PageResponse;
import com.portfolio.backend.entity.Article;
import com.portfolio.backend.entity.ArticleStatus;
import com.portfolio.backend.entity.User;
import com.portfolio.backend.exception.ResourceNotFoundException;
import com.portfolio.backend.mapper.ArticleMapper;
import com.portfolio.backend.repository.ArticleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.regex.Pattern;

@Service
@Transactional
public class ArticleService {

    private static final Logger log = LoggerFactory.getLogger(ArticleService.class);
    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^a-z0-9]+");
    private static final Pattern DIACRITICS = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");

    private final ArticleRepository articleRepository;
    private final ArticleMapper articleMapper;

    public ArticleService(ArticleRepository articleRepository, ArticleMapper articleMapper) {
        this.articleRepository = articleRepository;
        this.articleMapper = articleMapper;
    }

    @Transactional(readOnly = true)
    public PageResponse<ArticleResponse> getPublished(Pageable pageable, String tag) {
        Page<Article> page = (tag == null || tag.isBlank())
            ? articleRepository.findByStatusOrderByPublishedAtDesc(ArticleStatus.PUBLISHED, pageable)
            : articleRepository.findByStatusAndTag(ArticleStatus.PUBLISHED, tag, pageable);
        return PageResponse.from(page.map(articleMapper::toResponse));
    }

    @Transactional(readOnly = true)
    public ArticleResponse getPublishedBySlug(String slug) {
        Article article = articleRepository.findBySlugAndStatus(slug, ArticleStatus.PUBLISHED)
            .orElseThrow(() -> new ResourceNotFoundException("Article", "slug", slug));
        return articleMapper.toResponse(article);
    }

    @Transactional(readOnly = true)
    public PageResponse<ArticleResponse> getAllForAdmin(Pageable pageable) {
        Page<Article> page = articleRepository.findAllByOrderByCreatedAtDesc(pageable);
        return PageResponse.from(page.map(articleMapper::toResponse));
    }

    @Transactional(readOnly = true)
    public ArticleResponse getByIdForAdmin(Long id) {
        return articleMapper.toResponse(findArticleOrThrow(id));
    }

    public ArticleResponse createArticle(ArticleRequest request) {
        log.info("Création d'un nouvel article : {}", request.title());

        User currentUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        String slug = generateUniqueSlug(request.title());

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

        Article saved = articleRepository.save(article);
        log.info("Article créé avec l'ID: {}", saved.getId());
        return articleMapper.toResponse(saved);
    }

    public ArticleResponse updateArticle(Long id, ArticleRequest request) {
        log.info("Mise à jour de l'article ID: {}", id);

        Article article = findArticleOrThrow(id);
        boolean wasPublished = article.getStatus() == ArticleStatus.PUBLISHED;
        boolean isNowPublished = request.status() == ArticleStatus.PUBLISHED;

        article.setTitle(request.title());
        article.setSummary(request.summary());
        article.setContent(request.content());
        article.setContentType(request.contentType());
        article.setCoverImageUrl(request.coverImageUrl());
        article.setTags(request.tags() != null ? new ArrayList<>(request.tags()) : new ArrayList<>());
        article.setStatus(request.status());
        if (!wasPublished && isNowPublished) {
            article.setPublishedAt(LocalDateTime.now());
        }
        article.setUpdatedAt(LocalDateTime.now());

        Article saved = articleRepository.save(article);
        return articleMapper.toResponse(saved);
    }

    public void deleteArticle(Long id) {
        log.info("Suppression de l'article ID: {}", id);
        Article article = findArticleOrThrow(id);
        articleRepository.delete(article);
    }

    private Article findArticleOrThrow(Long id) {
        return articleRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Article", "id", id));
    }

    private String generateUniqueSlug(String title) {
        String base = slugify(title);
        String candidate = base;
        int suffix = 2;
        while (articleRepository.existsBySlug(candidate)) {
            candidate = base + "-" + suffix;
            suffix++;
        }
        return candidate;
    }

    private String slugify(String input) {
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD);
        String withoutDiacritics = DIACRITICS.matcher(normalized).replaceAll("");
        String lower = withoutDiacritics.toLowerCase();
        String hyphenated = NON_ALPHANUMERIC.matcher(lower).replaceAll("-");
        return hyphenated.replaceAll("^-+", "").replaceAll("-+$", "");
    }
}
