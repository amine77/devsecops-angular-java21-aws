{{/*
=============================================================================
_helpers.tpl — Helpers partagés entre tous les templates
=============================================================================
*/}}

{{/*
Nom complet de la release : release-name + chart-name (tronqué à 63 chars)
*/}}
{{- define "portfolio.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Nom court du chart
*/}}
{{- define "portfolio.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Labels standards Kubernetes (recommandés par Helm) — présents sur TOUS les objets
*/}}
{{- define "portfolio.labels" -}}
helm.sh/chart: {{ include "portfolio.chart" . }}
{{ include "portfolio.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: {{ .Values.global.appName | default "portfolio" }}
{{- end }}

{{/*
Labels de sélection — utilisés dans matchLabels ET podTemplateSpec
(doivent être STABLES — ne jamais changer après le premier déploiement)
*/}}
{{- define "portfolio.selectorLabels" -}}
app.kubernetes.io/name: {{ include "portfolio.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Nom du chart + version (pour helm.sh/chart label)
*/}}
{{- define "portfolio.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Labels spécifiques au composant backend
*/}}
{{- define "portfolio.backendLabels" -}}
{{ include "portfolio.labels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Selector labels backend
*/}}
{{- define "portfolio.backendSelectorLabels" -}}
{{ include "portfolio.selectorLabels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Labels spécifiques au composant frontend
*/}}
{{- define "portfolio.frontendLabels" -}}
{{ include "portfolio.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Selector labels frontend
*/}}
{{- define "portfolio.frontendSelectorLabels" -}}
{{ include "portfolio.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Image complète backend : registry/repository:tag
*/}}
{{- define "portfolio.backendImage" -}}
{{- $registry := .Values.global.imageRegistry | default "" }}
{{- $repo := .Values.backend.image.repository }}
{{- $tag := .Values.backend.image.tag | default "latest" }}
{{- if $registry }}
{{- printf "%s/%s:%s" $registry $repo $tag }}
{{- else }}
{{- printf "%s:%s" $repo $tag }}
{{- end }}
{{- end }}

{{/*
Image complète frontend : registry/repository:tag
*/}}
{{- define "portfolio.frontendImage" -}}
{{- $registry := .Values.global.imageRegistry | default "" }}
{{- $repo := .Values.frontend.image.repository }}
{{- $tag := .Values.frontend.image.tag | default "latest" }}
{{- if $registry }}
{{- printf "%s/%s:%s" $registry $repo $tag }}
{{- else }}
{{- printf "%s:%s" $repo $tag }}
{{- end }}
{{- end }}

{{/*
Nom du ConfigMap backend
*/}}
{{- define "portfolio.backendConfigMapName" -}}
{{- printf "%s-backend-config" (include "portfolio.fullname" .) }}
{{- end }}

{{/*
Nom du Secret (créé hors Helm)
*/}}
{{- define "portfolio.secretName" -}}
{{- .Values.backend.secretName | default "portfolio-secrets" }}
{{- end }}
