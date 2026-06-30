# Phase 22 — Scroll Storytelling UX

> **Stack** : GSAP · ScrollTrigger · Angular Directives

## Objectif

Renforcer l'impact visuel du portfolio pour les recruteurs en ajoutant des animations pilotées par le scroll ("scroll storytelling") sur l'ensemble du site, sans toucher à la palette, au contenu, ni à la structure HTML/Angular existante.

## Périmètre

Toutes les pages : Home, Projets (liste + détail), Compétences, navbar/footer, Login, Dashboard admin.

Déploiement **incrémental** : Home en premier (validée localement), puis Projets, Compétences, navbar/footer, Login/Admin.

## Décisions (Decision Log)

| Décision | Alternatives considérées | Pourquoi ce choix |
|----------|---------------------------|---------------------|
| Style "scroll storytelling" (parallax, reveal au scroll, compteurs) | 3D/WebGL immersif, glassmorphism + micro-interactions, bold/génératif | Meilleur rapport impact/risque : pas de dépendance 3D lourde (Three.js), sensation "vivante" forte sans complexité de rendu 3D |
| GSAP + ScrollTrigger comme moteur d'animation | Natif Angular (`@angular/animations` + `IntersectionObserver`) | Devenu 100% gratuit en 2025 (incl. plugins bonus), standard de l'industrie pour ce type d'effet, bien plus capable pour le scrub/pin/parallax que les keyframes CSS |
| Palette inchangée (dark slate-900 + accent bleu #3b82f6) | Faire évoluer la palette | Cohérence avec l'identité déjà établie (GitHub, LinkedIn) ; tout l'effort va dans le mouvement |
| Architecture hybride : service central + directive `appScrollReveal` pour le motif répétitif + timelines GSAP bespoke par composant pour les moments uniques | Tout en directives génériques déclaratives ; tout en ad-hoc par composant | Évite la sur-ingénierie d'une API générique pour des effets uniques par nature (hero, transitions) tout en évitant la duplication de code transverse (zone Angular, cleanup, a11y) sur 6+ pages |
| Périmètre inclut Login + Dashboard admin | Pages publiques uniquement | Demande explicite : cohérence totale de l'expérience, pas seulement les pages "vitrine" |
| GSAP chargé en lazy-loading par route | Chargement global au bootstrap | Ne pas alourdir le bundle initial des pages qui n'utilisent pas (encore) d'animation scroll |

## Assumptions

1. Déploiement incrémental (Home → Projets → Compétences → navbar/footer → Login/Admin), chaque étape validée en local avant de passer à la suite.
2. Respect de `prefers-reduced-motion` : si activé, le `ScrollAnimationService` devient no-op (affichage direct, sans animation).
3. Pas de régression sur les Core Web Vitals / Lighthouse, ni sur les tests Cypress E2E (Phase 13) et unitaires Angular (Phase 9) — à vérifier à chaque étape.
4. Structure HTML/Angular et logique métier inchangées ; uniquement la couche présentation/animation.
5. SBOM CycloneDX et Dependabot mis à jour pour inclure GSAP (cohérent avec la Phase 16/21 sécurité supply chain).

## Architecture technique

### `ScrollAnimationService` (`frontend/src/app/core/animation/scroll-animation.service.ts`)

- `reveal(element, options)` — enregistre un ScrollTrigger fade/slide-in
- `timeline()` — retourne une `gsap.timeline()` exécutée hors zone Angular (`NgZone.runOutsideAngular`)
- `refreshOnNavigation()` — appelé une fois dans `AppComponent`, appelle `ScrollTrigger.refresh()` à chaque changement de route Angular
- No-op global si `prefers-reduced-motion: reduce`

### Directive `appScrollReveal` (`frontend/src/app/shared/directives/scroll-reveal.directive.ts`)

Attribut réutilisable pour le motif répétitif (cartes, stats, items de liste). Inputs : `revealDelay`, `revealDirection` (`up`/`left`/`right`), `revealDistance`. Nettoyage dans `ngOnDestroy`.

## Design Home (étape 1)

- **Hero** : titre révélé mot par mot avec profondeur (translateZ + fade), code du terminal "tapé" en timeline, orbes en parallax scroll (vitesses différentes par orbe)
- **Transition Hero → Projets en vedette** : hero qui s'estompe/réduit en scrub au scroll ; cartes projets qui se déploient (rotation 3D -15°→0°, scale 0.92→1) en cascade via `appScrollReveal`
- **Stats** : compteurs animés de 0 à la valeur finale à l'entrée dans le viewport
- **Fil rouge** : barre de progression de scroll sous la navbar

## Étapes suivantes (non détaillées, à concevoir au moment venu)

Projets, Compétences, navbar/footer, Login, Dashboard admin — même architecture technique, concept visuel à définir page par page lors de l'implémentation incrémentale.
