# Phase 17 — Refonte UX & Développement Assisté par IA

## Objectif

Refonte visuelle complète du portfolio (8 composants Angular) en utilisant
**Claude Code** comme assistant IA et **21st Magic MCP** comme outil de génération
de composants UI. Cette phase démontre la maîtrise des outils d'IA modernes —
compétence transverse devenue incontournable dans les profils DevSecOps en 2025-2026.

---

## Résultats visuels

| Composant | Améliorations |
|-----------|---------------|
| **Hero / Home** | Orbes de gradient animés · Terminal macOS · Dot pulsant · Animations staggerées |
| **Navbar** | Shield SVG logo avec glow · Active indicator box-shadow · Glassmorphism |
| **Footer** | 3 colonnes : Brand · Stack · DevSecOps · Lien GitHub |
| **Project Card** | Grille CSS placeholder · Hover lift + glow · Featured badge · Titre accent |
| **Project List** | Compteur projets · États erreur/vide redessinés |
| **Skills** | Progress bars dégradé · Pourcentage · Icônes catégories |
| **Project Detail** | Hero header full-width · Back SVG · Layout card |
| **Login** | Card glassmorphism · Orbes bg · Shield SVG |

Aucune dépendance externe ajoutée — tout en CSS pur (`@keyframes`, `backdrop-filter`,
`box-shadow`) + SCSS existant.

---

## Outils d'IA utilisés

### 1. Claude Code — Assistant IA de développement

**Claude Code** est le CLI d'IA d'Anthropic qui tourne directement dans le terminal
et comprend l'intégralité d'une codebase. Il ne génère pas seulement du code — il lit,
comprend et modifie les fichiers existants dans leur contexte réel.

#### Workflow utilisé

```
1. Claude Code analyse les 12 composants Angular existants
   (template HTML, styles SCSS, TypeScript)

2. Il interroge 21st Magic MCP pour trouver des patterns
   de design correspondants (hero sections, terminaux, cards)

3. Il adapte les composants React/Tailwind retournés
   → Angular standalone + SCSS variables + design tokens existants

4. Il applique les modifications directement dans les fichiers
   avec cohérence de style (même palette, mêmes variables CSS)
```

#### Pourquoi c'est différent d'un simple "copier-coller d'IA"

- Comprend les **contraintes du projet** : Angular Material 3, dark theme, polices auto-hébergées (SonarCloud S5725)
- Respecte les **patterns Angular 20** : Signals, `ChangeDetectionStrategy.OnPush`, standalone components
- Corrige les **erreurs en temps réel** : diagnostics TypeScript et SonarCloud interprétés et corrigés immédiatement
- Maintient la **cohérence** : même langage de design sur les 8 composants en une session

#### Configuration Claude Code

```bash
# Installation
npm install -g @anthropic-ai/claude-code

# Lancement dans le projet
claude

# Skills disponibles (catalogue communautaire)
# /magic-ui-generator, /angular-best-practices, /ui-ux-designer, etc.
```

---

### 2. 21st Magic MCP — Bibliothèque UI via Model Context Protocol

**MCP (Model Context Protocol)** est un protocole open-source créé par Anthropic
qui permet à un LLM d'accéder à des outils externes via une interface standardisée.
Un serveur MCP expose des **tools** (fonctions) qu'un agent IA peut appeler,
exactement comme une API — mais depuis l'intérieur d'une conversation IA.

```
Claude Code
    │
    ├── Tool: mcp__magic__21st_magic_component_inspiration
    │         → Cherche des composants UI sur 21st.dev
    │         → Retourne le code React/Tailwind avec score de similarité
    │
    ├── Tool: mcp__magic__21st_magic_component_builder
    │         → Génère un composant personnalisé depuis une description
    │         → Paramètres : message, searchQuery, projectDirectory
    │
    └── Tool: mcp__magic__logo_search
              → Retourne des logos SVG en format TSX/JSX
```

#### Installation du MCP 21st Magic

```bash
# Via Claude Code settings (.claude/settings.json)
{
  "mcpServers": {
    "magic": {
      "command": "npx",
      "args": ["-y", "@21st-dev/magic@latest", "API_KEY"]
    }
  }
}
```

Ou via la commande intégrée :
```bash
claude mcp add @21st-dev/magic --api-key <votre-clé>
```

#### Workflow concret (exemple Hero Section)

```
1. Prompt : "Hero section for a DevSecOps portfolio — dark theme, 
             slate/blue palette, animated gradient, code snippet, 
             tech stack badges"

2. 21st Magic retourne 3 composants React avec leurs dépendances
   (LaunchUI Hero Section, Hero-1, Hero-2) + scores de similarité

3. Claude Code analyse les patterns :
   - Animated gradient orbs → adapté en CSS @keyframes orbFloat
   - Terminal with chrome → adapté en HTML pur + SCSS
   - Staggered animations → adapté avec animation-delay CSS custom props

4. Résultat : composant Angular pur, sans React/Tailwind,
   intégré dans l'architecture existante
```

---

## Architecture des Skills Claude Code

Les **Skills** sont des instructions spécialisées (fichiers `.md`) qui étendent
les capacités de Claude Code pour un domaine précis. Ils sont téléchargeables
depuis un catalogue communautaire ou créables localement.

```
~/.claude/
├── settings.json          # Config MCP servers, permissions, hooks
├── CLAUDE.md              # Instructions projet-level
└── skills/
    ├── angular.md         # Best practices Angular 20
    ├── magic-ui-generator.md  # Workflow 21st Magic
    └── ui-ux-designer.md  # Principes design system
```

### Skills utilisés dans cette phase

| Skill | Rôle |
|-------|------|
| `angular-best-practices` | Enforce Signals, OnPush, standalone patterns |
| `magic-ui-generator` | Workflow 21st Magic MCP → Angular adaptation |
| `ui-ux-designer` | Principes accessibilité et contraste WCAG |
| `fewer-permission-prompts` | Réduire les interruptions sur les outils read-only |

---

## Décisions techniques

### Pourquoi pas Tailwind CSS ?

Le projet utilise Angular Material 3 + SCSS custom variables. Ajouter Tailwind
aurait introduit un conflit de spécificité CSS difficile à maintenir et augmenté
la taille du bundle. Les animations ont été implémentées en CSS pur pour rester
dans l'architecture existante.

### Pourquoi des CSS custom properties (`--delay`, `--badge-delay`) ?

Permet de passer des valeurs dynamiques depuis le template Angular vers le CSS
sans JavaScript :

```scss
// Template Angular
[style.--badge-delay]="i * 60 + 'ms'"

// SCSS
.hero__badge {
  animation-delay: calc(600ms + var(--badge-delay, 0ms));
}
```

C'est le pattern le plus performant pour les animations staggerées dans Angular —
pas besoin d'`@HostBinding` ni d'`ElementRef`.

### Accessibilité (WCAG AA)

- Tous les éléments décoratifs ont `aria-hidden="true"`
- Les progress bars ont `role="progressbar"` + `aria-valuenow/min/max/label`
- Les contrastes de couleur ont été validés (SonarCloud css:S7924)
- Les animations respectent `prefers-reduced-motion` (hérité du browser)

---

## Impact sur le profil DevSecOps

### Pourquoi l'IA dans un profil DevSecOps ?

L'IA générative s'intègre maintenant dans toutes les phases du cycle DevSecOps :

| Phase DevSecOps | Usage IA |
|-----------------|----------|
| **Plan** | Génération de user stories, threat modeling assisté |
| **Code** | Claude Code, Copilot — génération et review de code |
| **Build** | Analyse SAST intelligente, réduction des faux positifs |
| **Test** | Génération de cas de test, analyse de coverage |
| **Deploy** | Kubernetes manifests, Terraform IaC assistés |
| **Operate** | Analyse de logs, incident response guidé |
| **Monitor** | Alerting intelligent, anomaly detection |
| **Secure** | Audit de code automatisé, CVE triage |

### MCP comme pattern d'intégration

Le protocole MCP représente un **changement d'architecture** important :
les outils métier (Jira, GitHub, AWS, SonarCloud) peuvent exposer leurs
fonctionnalités directement à un agent IA via des serveurs MCP, sans
nécessiter d'intégration manuelle. C'est l'équivalent des webhooks mais
pour les agents IA.

```
Agent IA (Claude Code)
    │
    ├── MCP: GitHub → créer PR, commenter issues
    ├── MCP: SonarCloud → analyser qualité, corriger findings
    ├── MCP: AWS → déployer, scaler, monitorer
    ├── MCP: 21st Magic → composants UI
    └── MCP: Terraform → planifier infra, appliquer changes
```

---

## Fichiers modifiés

```
frontend/src/app/
├── features/
│   ├── auth/login/
│   │   ├── login.component.html    ← Shield SVG, orbes bg, card glassmorphism
│   │   └── login.component.scss    ← Animations, backdrop-filter, contraste WCAG
│   └── portfolio/
│       ├── home/
│       │   ├── home.component.html ← Terminal chrome, pulsing dot, stagger
│       │   ├── home.component.scss ← @keyframes (6), terminal styles
│       │   └── home.component.ts   ← Angular 20, retryLoad(), categoryIcon()
│       ├── projects/
│       │   ├── project-list/project-list.component.ts  ← Header + compteur
│       │   └── project-detail/project-detail.component.ts ← Hero header
│       └── skills/skills.component.ts  ← Progress bars + icônes catégories
└── shared/components/
    ├── navbar/
    │   ├── navbar.component.ts     ← Shield SVG inline
    │   └── navbar.component.scss   ← Glow, box-shadow active, hover
    ├── footer/footer.component.ts  ← 3 colonnes, tech list, GitHub link
    └── project-card/project-card.component.ts ← Grille, hover lift, badge
```

---

## Références

- [Claude Code](https://claude.ai/code) — CLI d'IA pour le développement
- [Model Context Protocol](https://modelcontextprotocol.io) — Spec Anthropic open-source
- [21st.dev Magic](https://21st.dev) — Bibliothèque de composants UI pour agents IA
- [MCP Registry](https://registry.npmmirror.com/@21st-dev/magic) — Serveur MCP npm
- [Angular Signals](https://angular.dev/guide/signals) — Réactivité Angular 20
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/--*) — Variables pour animations dynamiques
