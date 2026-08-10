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
