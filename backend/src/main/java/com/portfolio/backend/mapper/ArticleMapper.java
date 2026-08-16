package com.portfolio.backend.mapper;

import com.portfolio.backend.dto.response.ArticleResponse;
import com.portfolio.backend.entity.Article;
import org.springframework.stereotype.Component;

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
            article.getTags(),
            article.getStatus(),
            article.getPublishedAt(),
            article.getUser().getFirstName() + " " + article.getUser().getLastName(),
            article.getCreatedAt(),
            article.getUpdatedAt()
        );
    }

    public List<ArticleResponse> toResponseList(List<Article> articles) {
        return articles.stream().map(this::toResponse).toList();
    }
}
