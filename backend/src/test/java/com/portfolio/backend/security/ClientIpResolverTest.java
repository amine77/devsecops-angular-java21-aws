package com.portfolio.backend.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests de la résolution d'IP client.
 *
 * <p>Enjeu : si cette classe se trompe, le rate limiter compte des clés que
 * l'attaquant contrôle et ne bloque plus rien tout en paraissant fonctionner.
 */
@DisplayName("ClientIpResolver — clé de limitation non falsifiable")
class ClientIpResolverTest {

    private static final String REAL_CLIENT_IP = "203.0.113.42";
    private static final String PROXY_IP = "172.18.0.5";

    private static MockHttpServletRequest request(String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(remoteAddr);
        return request;
    }

    @Test
    @DisplayName("Derrière le proxy, utilise X-Real-IP (écrasé par NGINX)")
    void usesRealIpHeaderBehindProxy() {
        MockHttpServletRequest request = request(PROXY_IP);
        request.addHeader("X-Real-IP", REAL_CLIENT_IP);

        assertThat(new ClientIpResolver(true).resolve(request)).isEqualTo(REAL_CLIENT_IP);
    }

    @Test
    @DisplayName("Ignore X-Forwarded-For, dont la première valeur vient du client")
    void ignoresForwardedForHeader() {
        MockHttpServletRequest request = request(PROXY_IP);
        // Ce que produit "$proxy_add_x_forwarded_for" quand le client a déjà
        // envoyé son propre X-Forwarded-For : la valeur choisie par l'attaquant
        // est en tête. Une implémentation qui ferait split(",")[0] lui laisserait
        // changer de clé de limitation à chaque requête.
        request.addHeader("X-Forwarded-For", "1.2.3.4, " + REAL_CLIENT_IP);
        request.addHeader("X-Real-IP", REAL_CLIENT_IP);

        assertThat(new ClientIpResolver(true).resolve(request)).isEqualTo(REAL_CLIENT_IP);
    }

    @Test
    @DisplayName("Sans proxy, ignore le header et prend l'adresse TCP")
    void usesRemoteAddrWhenNotBehindProxy() {
        MockHttpServletRequest request = request(REAL_CLIENT_IP);
        request.addHeader("X-Real-IP", "1.2.3.4");

        assertThat(new ClientIpResolver(false).resolve(request)).isEqualTo(REAL_CLIENT_IP);
    }

    @Test
    @DisplayName("Header absent (appel direct en dev) : repli sur l'adresse TCP")
    void fallsBackWhenHeaderMissing() {
        assertThat(new ClientIpResolver(true).resolve(request(REAL_CLIENT_IP)))
            .isEqualTo(REAL_CLIENT_IP);
    }

    @Test
    @DisplayName("Header aberrant : repli sur l'adresse TCP plutôt que clé arbitraire")
    void rejectsAbnormalHeaderValues() {
        ClientIpResolver resolver = new ClientIpResolver(true);

        MockHttpServletRequest tooLong = request(PROXY_IP);
        tooLong.addHeader("X-Real-IP", "x".repeat(200));
        assertThat(resolver.resolve(tooLong)).isEqualTo(PROXY_IP);

        MockHttpServletRequest multiValued = request(PROXY_IP);
        multiValued.addHeader("X-Real-IP", "1.2.3.4, 5.6.7.8");
        assertThat(resolver.resolve(multiValued)).isEqualTo(PROXY_IP);

        MockHttpServletRequest blank = request(PROXY_IP);
        blank.addHeader("X-Real-IP", "   ");
        assertThat(resolver.resolve(blank)).isEqualTo(PROXY_IP);
    }
}
