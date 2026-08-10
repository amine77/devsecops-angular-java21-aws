export type ArticleStatus = 'DRAFT' | 'PUBLISHED';

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
  coverImageUrl?: string;
  tags: string[];
  status: ArticleStatus;
}
