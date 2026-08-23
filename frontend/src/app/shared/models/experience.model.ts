/**
 * Modèle expérience — miroir de ExperienceResponse Java.
 * readonly : les données reçues de l'API ne doivent pas être mutées directement.
 */
export interface Experience {
  readonly id: number;
  readonly entreprise: string;
  readonly poste: string;
  readonly contexte?: string;
  readonly dateDebut: string;
  readonly dateFin?: string;
  readonly current: boolean;
  readonly description: string;
  readonly realisations: string[];
  readonly stack: string[];
  readonly ordreAffichage: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Payload pour créer ou modifier une expérience — miroir de ExperienceRequest Java.
 * Mutable car c'est le formulaire de saisie.
 */
export interface ExperienceFormData {
  entreprise: string;
  poste: string;
  contexte?: string;
  dateDebut: string;
  dateFin?: string | null;
  description: string;
  realisations: string[];
  stack: string[];
  ordreAffichage: number;
}
