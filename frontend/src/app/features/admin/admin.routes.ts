import { Routes } from '@angular/router';
import { adminGuard } from '@core/guards/auth.guard';

export const adminRoutes: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Dashboard Admin',
  },
  {
    path: 'projects/new',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./project-form/project-form.component').then((m) => m.ProjectFormComponent),
    title: 'Nouveau projet',
  },
  {
    path: 'projects/:id/edit',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./project-form/project-form.component').then((m) => m.ProjectFormComponent),
    title: 'Modifier le projet',
  },
  {
    path: 'experiences/new',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./experience-form/experience-form.component').then(
        (m) => m.ExperienceFormComponent
      ),
    title: 'Nouvelle expérience',
  },
  {
    path: 'experiences/:id/edit',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./experience-form/experience-form.component').then(
        (m) => m.ExperienceFormComponent
      ),
    title: "Modifier l'expérience",
  },
  {
    path: 'articles/new',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./article-form/article-form.component').then((m) => m.ArticleFormComponent),
    title: 'Nouvel article',
  },
  {
    path: 'articles/:id/edit',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./article-form/article-form.component').then((m) => m.ArticleFormComponent),
    title: "Modifier l'article",
  },
];
