export type SkillCategory = 'BACKEND' | 'FRONTEND' | 'DEVOPS' | 'CLOUD' | 'OTHER';

export interface Skill {
  readonly id: number;
  readonly name: string;
  readonly category: SkillCategory;
  readonly iconUrl?: string;
  readonly level: 1 | 2 | 3 | 4 | 5;
  readonly sortOrder: number;
}

/** Map des libellés de catégories (UI). */
export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  BACKEND: 'Backend',
  FRONTEND: 'Frontend',
  DEVOPS: 'DevOps',
  CLOUD: 'Cloud',
  OTHER: 'Autre',
};
