export type SkillCategory = 'BACKEND' | 'FRONTEND' | 'CLOUD_DEVOPS' | 'QUALITY' | 'OTHER';

export type SkillLevel = 'EXPERT' | 'AVANCE' | 'INTERMEDIAIRE';

export interface Skill {
  readonly id: number;
  readonly name: string;
  readonly category: SkillCategory;
  readonly iconUrl?: string;
  readonly level: SkillLevel;
  readonly sortOrder: number;
}

/** Map des clés i18n des libellés de catégories (UI). */
export const SKILL_CATEGORY_LABEL_KEYS: Record<SkillCategory, string> = {
  BACKEND: 'skills.category.backend',
  FRONTEND: 'skills.category.frontend',
  CLOUD_DEVOPS: 'skills.category.cloudDevops',
  QUALITY: 'skills.category.quality',
  OTHER: 'skills.category.other',
};
