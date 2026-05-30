import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProjectCardComponent } from '@shared/components/project-card/project-card.component';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { ProjectService } from '@core/services/project.service';
import { Project } from '@shared/models/project.model';

/**
 * Page d'accueil du portfolio.
 *
 * Affiche :
 * - Section hero (présentation)
 * - Projets en vedette (featured)
 * - Appel à l'action vers la liste complète
 *
 * Utilise des Signals pour l'état asynchrone :
 * - projects() : liste des projets featured
 * - isLoading() : état de chargement
 * - error() : message d'erreur
 *
 * Pattern moderne Angular 18 :
 * Pas de AsyncPipe ni de subscribe manuel dans le template.
 * Le signal est mis à jour dans le callback next/error de subscribe.
 */
@Component({
    selector: 'app-home',
    imports: [RouterLink, ProjectCardComponent, LoadingSpinnerComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './home.component.html',
    styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  private readonly projectService = inject(ProjectService);

  protected readonly featuredProjects = signal<Project[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly techStack = [
    'Angular 20', 'Spring Boot', 'Java 21', 'PostgreSQL',
    'Docker', 'Kubernetes', 'Helm', 'Terraform', 'AWS', 'GitHub Actions',
  ];

  protected readonly stats = [
    { value: '5+', label: 'Ans d\'expérience' },
    { value: '15+', label: 'Projets livrés' },
    { value: '10+', label: 'Technologies maîtrisées' },
    { value: '100%', label: 'Passion du code' },
  ];

  ngOnInit(): void {
    this.loadFeaturedProjects();
  }

  protected retryLoad(): void {
    this.error.set(null);
    this.isLoading.set(true);
    this.loadFeaturedProjects();
  }

  private loadFeaturedProjects(): void {
    this.projectService.getFeaturedProjects().subscribe({
      next: (projects) => {
        this.featuredProjects.set(projects);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les projets.');
        this.isLoading.set(false);
      },
    });
  }
}
