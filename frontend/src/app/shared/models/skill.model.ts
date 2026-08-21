export type SkillCategory = 'BACKEND' | 'FRONTEND' | 'DEVOPS' | 'CLOUD' | 'QUALITY' | 'OTHER';

export type SkillLevel = 'EXPERT' | 'AVANCE' | 'INTERMEDIAIRE';

export interface Skill {
  readonly id: number;
  readonly name: string;
  readonly category: SkillCategory;
  readonly iconUrl?: string;
  readonly level: SkillLevel;
  readonly sortOrder: number;
}

/** Map des libellés de catégories (UI). */
export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  BACKEND: 'Backend',
  FRONTEND: 'Frontend',
  DEVOPS: 'DevOps',
  CLOUD: 'Cloud',
  QUALITY: 'Qualité & Tests',
  OTHER: 'Autre',
};
