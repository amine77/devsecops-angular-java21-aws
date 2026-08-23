package com.portfolio.backend.service;

import com.portfolio.backend.dto.request.ExperienceRequest;
import com.portfolio.backend.dto.response.ExperienceResponse;
import com.portfolio.backend.entity.Experience;
import com.portfolio.backend.entity.User;
import com.portfolio.backend.exception.ResourceNotFoundException;
import com.portfolio.backend.mapper.ExperienceMapper;
import com.portfolio.backend.repository.ExperienceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional
public class ExperienceService {

    private static final Logger log = LoggerFactory.getLogger(ExperienceService.class);

    private final ExperienceRepository experienceRepository;
    private final ExperienceMapper experienceMapper;

    public ExperienceService(ExperienceRepository experienceRepository, ExperienceMapper experienceMapper) {
        this.experienceRepository = experienceRepository;
        this.experienceMapper = experienceMapper;
    }

    @Transactional(readOnly = true)
    public List<ExperienceResponse> getAll() {
        return experienceMapper.toResponseList(experienceRepository.findAllByOrderByOrdreAffichageAsc());
    }

    @Transactional(readOnly = true)
    public ExperienceResponse getById(Long id) {
        return experienceMapper.toResponse(findExperienceOrThrow(id));
    }

    public ExperienceResponse createExperience(ExperienceRequest request) {
        log.info("Création d'une nouvelle expérience : {} chez {}", request.poste(), request.entreprise());

        User currentUser = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();

        Experience experience = Experience.builder()
            .entreprise(request.entreprise())
            .poste(request.poste())
            .contexte(request.contexte())
            .dateDebut(request.dateDebut())
            .dateFin(request.dateFin())
            .description(request.description())
            .realisations(request.realisations() != null ? new ArrayList<>(request.realisations()) : new ArrayList<>())
            .stack(request.stack() != null ? new ArrayList<>(request.stack()) : new ArrayList<>())
            .ordreAffichage(request.ordreAffichage())
            .user(currentUser)
            .build();

        Experience saved = experienceRepository.save(experience);
        log.info("Expérience créée avec l'ID: {}", saved.getId());
        return experienceMapper.toResponse(saved);
    }

    public ExperienceResponse updateExperience(Long id, ExperienceRequest request) {
        log.info("Mise à jour de l'expérience ID: {}", id);

        Experience experience = findExperienceOrThrow(id);
        experience.setEntreprise(request.entreprise());
        experience.setPoste(request.poste());
        experience.setContexte(request.contexte());
        experience.setDateDebut(request.dateDebut());
        experience.setDateFin(request.dateFin());
        experience.setDescription(request.description());
        experience.setRealisations(
            request.realisations() != null ? new ArrayList<>(request.realisations()) : new ArrayList<>());
        experience.setStack(request.stack() != null ? new ArrayList<>(request.stack()) : new ArrayList<>());
        experience.setOrdreAffichage(request.ordreAffichage());
        experience.setUpdatedAt(LocalDateTime.now());

        Experience saved = experienceRepository.save(experience);
        return experienceMapper.toResponse(saved);
    }

    public void deleteExperience(Long id) {
        log.info("Suppression de l'expérience ID: {}", id);
        Experience experience = findExperienceOrThrow(id);
        experienceRepository.delete(experience);
    }

    private Experience findExperienceOrThrow(Long id) {
        return experienceRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Experience", "id", id));
    }
}
