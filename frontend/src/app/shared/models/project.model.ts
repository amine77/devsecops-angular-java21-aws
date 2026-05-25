import { Skill } from './skill.model';

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';

/**
 * Modèle projet — miroir de ProjectResponse Java.
 * readonly : les données reçues de l'API ne doivent pas être mutées directement.
 */
export interface Project {
  readonly id: number;
  readonly title: string;
  readonly description: string;
  readonly summary?: string;
  readonly githubUrl?: string;
  readonly demoUrl?: string;
  readonly imageUrl?: string;
  readonly status: ProjectStatus;
  readonly featured: boolean;
  readonly sortOrder: number;
  readonly skills: Skill[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Payload pour créer ou modifier un projet — miroir de ProjectRequest Java.
 * Mutable car c'est le formulaire de saisie.
 */
export interface ProjectFormData {
  title: string;
  description: string;
  summary?: string;
  githubUrl?: string;
  demoUrl?: string;
  imageUrl?: string;
  featured: boolean;
  sortOrder: number;
  skillIds: number[];
}
