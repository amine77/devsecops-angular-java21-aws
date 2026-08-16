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
