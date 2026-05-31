package com.portfolio.backend.controller;

import com.portfolio.backend.config.SecurityConfig;
import com.portfolio.backend.dto.response.SkillResponse;
import com.portfolio.backend.exception.GlobalExceptionHandler;
import com.portfolio.backend.observability.AppMetrics;
import com.portfolio.backend.security.JwtAccessDeniedHandler;
import com.portfolio.backend.security.JwtAuthenticationEntryPoint;
import com.portfolio.backend.security.JwtTokenProvider;
import com.portfolio.backend.service.SkillService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SkillController.class)
@Import({GlobalExceptionHandler.class, SecurityConfig.class,
    JwtAuthenticationEntryPoint.class, JwtAccessDeniedHandler.class})
@DisplayName("SkillController — Tests Web Layer")
class SkillControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SkillService skillService;

    @MockBean
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private AppMetrics appMetrics;

    private SkillResponse skill(String name, String cat) {
        return new SkillResponse(1L, name, cat, null, 1, 1);
    }

    @Test
    @DisplayName("GET /skills retourne toutes les compétences")
    void shouldReturnAllSkills() throws Exception {
        given(skillService.getAllSkills()).willReturn(List.of(
            skill("Java", "BACKEND"),
            skill("Angular", "FRONTEND")
        ));

        mockMvc.perform(get("/skills"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.length()").value(2));
    }

    @Test
    @DisplayName("GET /skills?category=BACKEND filtre par catégorie")
    void shouldReturnSkillsFilteredByCategory() throws Exception {
        given(skillService.getSkillsByCategory("BACKEND")).willReturn(List.of(
            skill("Java", "BACKEND")
        ));

        mockMvc.perform(get("/skills").param("category", "BACKEND"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.length()").value(1))
            .andExpect(jsonPath("$.data[0].name").value("Java"));
    }

    @Test
    @DisplayName("GET /skills retourne une liste vide si aucune compétence")
    void shouldReturnEmptyList() throws Exception {
        given(skillService.getAllSkills()).willReturn(List.of());

        mockMvc.perform(get("/skills"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.length()").value(0));
    }
}
