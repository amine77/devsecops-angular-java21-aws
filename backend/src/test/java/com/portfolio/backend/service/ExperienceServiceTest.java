package com.portfolio.backend.service;

import com.portfolio.backend.dto.request.ExperienceRequest;
import com.portfolio.backend.dto.response.ExperienceResponse;
import com.portfolio.backend.entity.Experience;
import com.portfolio.backend.entity.User;
import com.portfolio.backend.exception.ResourceNotFoundException;
import com.portfolio.backend.mapper.ExperienceMapper;
import com.portfolio.backend.repository.ExperienceRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@DisplayName("ExperienceService — Tests unitaires")
class ExperienceServiceTest {

    @Mock
    private ExperienceRepository experienceRepository;

    @Mock
    private ExperienceMapper experienceMapper;

    @InjectMocks
    private ExperienceService experienceService;

    private Experience testExperience;
    private ExperienceResponse testExperienceResponse;

    @BeforeEach
    void setUp() {
        User mockUser = User.builder()
            .id(1L)
            .email("admin@portfolio.dev")
            .firstName("Amine")
            .lastName("Charrad")
            .build();
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(new UsernamePasswordAuthenticationToken(mockUser, null, List.of()));
        SecurityContextHolder.setContext(ctx);

        testExperience = Experience.builder()
            .id(1L)
            .entreprise("Allianz France")
            .poste("Tech Lead")
            .contexte("Groupe d'assurance international")
            .dateDebut(LocalDate.of(2020, 6, 1))
            .dateFin(null)
            .description("Description")
            .realisations(List.of("Réalisation 1"))
            .stack(List.of("Java 21"))
            .ordreAffichage(1)
            .build();

        testExperienceResponse = new ExperienceResponse(
            1L, "Allianz France", "Tech Lead", null, "Groupe d'assurance international", null,
            LocalDate.of(2020, 6, 1), null, true, "Description", null,
            List.of("Réalisation 1"), List.of(), List.of("Java 21"), 1, null, null
        );
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Nested
    @DisplayName("getAll() — liste ordonnée")
    class GetAllTests {

        @Test
        @DisplayName("Retourne la liste triée par ordre d'affichage")
        void shouldReturnListOrderedByOrdreAffichage() {
            given(experienceRepository.findAllByOrderByOrdreAffichageAsc()).willReturn(List.of(testExperience));
            given(experienceMapper.toResponseList(List.of(testExperience))).willReturn(List.of(testExperienceResponse));

            List<ExperienceResponse> result = experienceService.getAll();

            assertThat(result).hasSize(1);
            assertThat(result.get(0).entreprise()).isEqualTo("Allianz France");
        }
    }

    @Nested
    @DisplayName("getById() — accès public par ID")
    class GetByIdTests {

        @Test
        @DisplayName("Retourne l'expérience quand l'ID existe")
        void shouldReturnExperienceWhenIdExists() {
            given(experienceRepository.findById(1L)).willReturn(Optional.of(testExperience));
            given(experienceMapper.toResponse(testExperience)).willReturn(testExperienceResponse);

            ExperienceResponse result = experienceService.getById(1L);

            assertThat(result).isNotNull();
            assertThat(result.entreprise()).isEqualTo("Allianz France");
        }

        @Test
        @DisplayName("Lance ResourceNotFoundException si l'ID n'existe pas")
        void shouldThrowNotFoundWhenIdDoesNotExist() {
            given(experienceRepository.findById(99L)).willReturn(Optional.empty());

            assertThatThrownBy(() -> experienceService.getById(99L))
                .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    @Nested
    @DisplayName("createExperience() — création")
    class CreateExperienceTests {

        @Test
        @DisplayName("Persiste dateFin=null pour une mission en cours")
        void shouldPersistNullDateFinForCurrentMission() {
            ExperienceRequest request = new ExperienceRequest(
                "Allianz France", "Tech Lead", "Contexte", LocalDate.of(2020, 6, 1), null,
                "Description", List.of("R1"), List.of("Java 21"), 1
            );
            given(experienceRepository.save(any(Experience.class))).willReturn(testExperience);
            given(experienceMapper.toResponse(testExperience)).willReturn(testExperienceResponse);

            experienceService.createExperience(request);

            ArgumentCaptor<Experience> captor = ArgumentCaptor.forClass(Experience.class);
            verify(experienceRepository).save(captor.capture());
            assertThat(captor.getValue().getDateFin()).isNull();
        }

        @Test
        @DisplayName("Persiste les réalisations et la stack dans l'ordre fourni")
        void shouldPersistRealisationsAndStackInOrder() {
            ExperienceRequest request = new ExperienceRequest(
                "Boursorama", "Développeur", "Contexte", LocalDate.of(2017, 2, 1), LocalDate.of(2019, 3, 1),
                "Description", List.of("R1", "R2"), List.of("Java 8", "Symfony 3"), 3
            );
            given(experienceRepository.save(any(Experience.class))).willReturn(testExperience);
            given(experienceMapper.toResponse(testExperience)).willReturn(testExperienceResponse);

            experienceService.createExperience(request);

            ArgumentCaptor<Experience> captor = ArgumentCaptor.forClass(Experience.class);
            verify(experienceRepository).save(captor.capture());
            assertThat(captor.getValue().getRealisations()).containsExactly("R1", "R2");
            assertThat(captor.getValue().getStack()).containsExactly("Java 8", "Symfony 3");
        }
    }

    @Nested
    @DisplayName("updateExperience() — mise à jour")
    class UpdateExperienceTests {

        @Test
        @DisplayName("Met à jour les champs de l'expérience existante")
        void shouldUpdateExistingExperience() {
            ExperienceRequest request = new ExperienceRequest(
                "Allianz France", "Tech Lead Senior", "Nouveau contexte", LocalDate.of(2020, 6, 1), null,
                "Nouvelle description", List.of("R1"), List.of("Java 21"), 1
            );
            given(experienceRepository.findById(1L)).willReturn(Optional.of(testExperience));
            given(experienceRepository.save(any(Experience.class))).willReturn(testExperience);
            given(experienceMapper.toResponse(testExperience)).willReturn(testExperienceResponse);

            experienceService.updateExperience(1L, request);

            assertThat(testExperience.getPoste()).isEqualTo("Tech Lead Senior");
            assertThat(testExperience.getContexte()).isEqualTo("Nouveau contexte");
        }

        @Test
        @DisplayName("Lance ResourceNotFoundException si l'expérience n'existe pas")
        void shouldThrowNotFoundWhenExperienceDoesNotExist() {
            ExperienceRequest request = new ExperienceRequest(
                "Allianz France", "Tech Lead", "Contexte", LocalDate.of(2020, 6, 1), null,
                "Description", List.of(), List.of(), 1
            );
            given(experienceRepository.findById(99L)).willReturn(Optional.empty());

            assertThatThrownBy(() -> experienceService.updateExperience(99L, request))
                .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    @Nested
    @DisplayName("deleteExperience() — suppression")
    class DeleteExperienceTests {

        @Test
        @DisplayName("Supprime l'expérience de manière définitive")
        void shouldHardDeleteExperience() {
            given(experienceRepository.findById(1L)).willReturn(Optional.of(testExperience));

            experienceService.deleteExperience(1L);

            verify(experienceRepository).delete(testExperience);
        }

        @Test
        @DisplayName("Lance ResourceNotFoundException si l'expérience n'existe pas")
        void shouldThrowNotFoundWhenExperienceDoesNotExist() {
            given(experienceRepository.findById(99L)).willReturn(Optional.empty());

            assertThatThrownBy(() -> experienceService.deleteExperience(99L))
                .isInstanceOf(ResourceNotFoundException.class);
        }
    }
}
