package com.portfolio.backend.mapper;

import com.portfolio.backend.dto.response.ArticleResponse;
import com.portfolio.backend.entity.Article;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class ArticleMapper {

    public ArticleResponse toResponse(Article article) {
        return new ArticleResponse(
            article.getId(),
            article.getTitle(),
            article.getSlug(),
            article.getSummary(),
            article.getContent(),
            article.getContentType(),
            article.getCoverImageUrl(),
            new ArrayList<>(article.getTags()),
            article.getStatus(),
            article.getPublishedAt(),
            article.getUser().getFirstName() + " " + article.getUser().getLastName(),
            article.getCreatedAt(),
            article.getUpdatedAt()
        );
    }

    /**
     * Variante allégée pour les listes : le contenu (HTML designé, 45 à 100 Ko par article)
     * est vidé, les cartes n'affichent que le résumé. Le contenu complet reste servi par
     * le détail (/articles/{slug}).
     */
    public ArticleResponse toListItem(Article article) {
        ArticleResponse full = toResponse(article);
        return new ArticleResponse(
            full.id(),
            full.title(),
            full.slug(),
            full.summary(),
            "",
            full.contentType(),
            full.coverImageUrl(),
            full.tags(),
            full.status(),
            full.publishedAt(),
            full.authorName(),
            full.createdAt(),
            full.updatedAt()
        );
    }

    public List<ArticleResponse> toResponseList(List<Article> articles) {
        return articles.stream().map(this::toResponse).toList();
    }
}
