import { Routes } from '@angular/router';

export const portfolioRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
    title: 'Portfolio DevSecOps',
  },
  {
    path: 'experience',
    loadComponent: () =>
      import('./experience/experience.component').then((m) => m.ExperienceComponent),
    title: 'Expérience — Portfolio',
  },
  {
    path: 'projects',
    loadComponent: () =>
      import('./projects/project-list/project-list.component').then((m) => m.ProjectListComponent),
    title: 'Projets — Portfolio',
  },
  {
    path: 'projects/:id',
    loadComponent: () =>
      import('./projects/project-detail/project-detail.component').then(
        (m) => m.ProjectDetailComponent
      ),
    title: 'Projet — Portfolio',
  },
  {
    path: 'blog',
    loadComponent: () =>
      import('./blog/blog-list/blog-list.component').then((m) => m.BlogListComponent),
    title: 'Blog — Portfolio',
  },
  {
    path: 'blog/:slug',
    loadComponent: () =>
      import('./blog/blog-detail/blog-detail.component').then((m) => m.BlogDetailComponent),
    title: 'Article — Portfolio',
  },
  {
    path: 'skills',
    loadComponent: () => import('./skills/skills.component').then((m) => m.SkillsComponent),
    title: 'Compétences — Portfolio',
  },
];
