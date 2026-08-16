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
