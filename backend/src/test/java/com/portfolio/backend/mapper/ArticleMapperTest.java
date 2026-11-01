package com.portfolio.backend.mapper;

import com.portfolio.backend.dto.response.ArticleResponse;
import com.portfolio.backend.entity.Article;
import com.portfolio.backend.entity.ArticleContentType;
import com.portfolio.backend.entity.ArticleStatus;
import com.portfolio.backend.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("ArticleMapper — Tests unitaires")
class ArticleMapperTest {

    private final ArticleMapper mapper = new ArticleMapper();
    private Article article;

    @BeforeEach
    void setUp() {
        User author = User.builder().id(1L).firstName("Amine").lastName("Charrad").build();
        article = Article.builder()
            .id(7L)
            .title("Optimiser une application Java")
            .slug("optimiser-application-java")
            .summary("Résumé de l'article")
            .content("<!DOCTYPE html><html><body>Contenu volumineux</body></html>")
            .contentType(ArticleContentType.HTML)
            .tags(List.of("java", "performance"))
            .status(ArticleStatus.PUBLISHED)
            .user(author)
            .build();
    }

    @Test
    @DisplayName("toResponse() conserve le contenu complet")
    void toResponseShouldKeepContent() {
        ArticleResponse response = mapper.toResponse(article);

        assertThat(response.content()).isEqualTo(article.getContent());
    }

    @Test
    @DisplayName("toListItem() vide le contenu mais conserve les métadonnées de la carte")
    void toListItemShouldStripContentAndKeepMetadata() {
        ArticleResponse item = mapper.toListItem(article);

        assertThat(item.content()).isEmpty();
        assertThat(item.id()).isEqualTo(7L);
        assertThat(item.slug()).isEqualTo("optimiser-application-java");
        assertThat(item.summary()).isEqualTo("Résumé de l'article");
        assertThat(item.contentType()).isEqualTo(ArticleContentType.HTML);
        assertThat(item.tags()).containsExactly("java", "performance");
        assertThat(item.authorName()).isEqualTo("Amine Charrad");
    }
}
