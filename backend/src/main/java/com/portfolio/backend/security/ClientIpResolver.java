package com.portfolio.backend.security;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Détermine l'adresse IP réelle du client, y compris derrière le reverse proxy NGINX.
 *
 * <p><b>Pourquoi {@code X-Real-IP} et surtout PAS {@code X-Forwarded-For}</b> —
 * c'est le point qui décide si le rate limiter est contournable ou non :
 *
 * <pre>
 * nginx.conf :
 *   proxy_set_header X-Real-IP       $remote_addr;              ← AFFECTATION
 *   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; ← AJOUT
 * </pre>
 *
 * <p>{@code X-Real-IP} est <i>écrasé</i> par NGINX : si un attaquant envoie
 * {@code X-Real-IP: 1.2.3.4}, NGINX remplace la valeur par la vraie IP TCP. Le
 * header est donc digne de confiance.
 *
 * <p>{@code X-Forwarded-For} est <i>concaténé</i> : la valeur envoyée par le
 * client survit et se retrouve en <b>première</b> position, la vraie IP étant
 * ajoutée à la fin. Une implémentation qui fait {@code xff.split(",")[0]} —
 * l'erreur classique — laisse l'attaquant choisir sa propre clé de limitation
 * et changer d'identité à chaque requête. Le rate limiter ne bloque alors
 * plus rien tout en donnant l'illusion de fonctionner.
 *
 * <p><b>Prérequis de déploiement</b> : faire confiance à un header n'a de sens
 * que si NGINX est le seul chemin d'entrée. Deux contrôles distincts, à ne pas
 * confondre :
 *
 * <ul>
 *   <li><b>Local</b> ({@code docker-compose.prod.yml}) : {@code ports: []}
 *       retire la publication du port — le backend n'est joignable que par le
 *       réseau Docker interne.</li>
 *   <li><b>Sur EC2</b> : le compose généré par le user-data publie bel et bien
 *       {@code 8080:8080} sur l'hôte. Ce qui protège l'accès direct est le
 *       groupe de sécurité, dont la règle d'entrée 8080 est commentée
 *       (terraform/modules/security-groups/main.tf). C'est un contrôle réseau,
 *       pas un contrôle Docker.</li>
 * </ul>
 *
 * <p><b>Conséquence à retenir</b> : rouvrir le port 8080 dans le groupe de
 * sécurité — ne serait-ce que temporairement pour du débogage — rend ce header
 * falsifiable. Un attaquant atteignant directement le backend choisit alors sa
 * clé de limitation et en change à chaque requête : le limiteur continue de
 * tourner, mais ne bloque plus rien. Dans ce cas de figure, il faut passer
 * {@code app.rate-limit.behind-proxy} à false pour revenir à l'IP TCP.
 */
public class ClientIpResolver {

    private static final String REAL_IP_HEADER = "X-Real-IP";

    /** Longueur max d'une IPv6 textuelle avec zone ("::ffff:255.255.255.255%enp0s3"). */
    private static final int MAX_IP_LENGTH = 64;

    private final boolean behindProxy;

    public ClientIpResolver(boolean behindProxy) {
        this.behindProxy = behindProxy;
    }

    /**
     * Retourne l'IP à utiliser comme clé de limitation.
     *
     * <p>Repli sur {@code getRemoteAddr()} si le header est absent (appel direct
     * en développement) ou visiblement anormal.
     */
    public String resolve(HttpServletRequest request) {
        if (behindProxy) {
            String header = request.getHeader(REAL_IP_HEADER);
            if (header != null) {
                String candidate = header.trim();
                // Un header trop long ou multi-valué ne vient pas de notre NGINX.
                // On refuse de s'en servir comme clé de cache : ce serait offrir
                // à l'attaquant un moyen de faire grossir la map à volonté.
                if (!candidate.isEmpty()
                    && candidate.length() <= MAX_IP_LENGTH
                    && candidate.indexOf(',') < 0) {
                    return candidate;
                }
            }
        }
        String remoteAddr = request.getRemoteAddr();
        return remoteAddr == null ? "unknown" : remoteAddr;
    }
}
