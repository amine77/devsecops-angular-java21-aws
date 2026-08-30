package com.portfolio.backend.mapper;

import com.portfolio.backend.dto.response.ExperienceResponse;
import com.portfolio.backend.entity.Experience;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class ExperienceMapper {

    public ExperienceResponse toResponse(Experience experience) {
        return new ExperienceResponse(
            experience.getId(),
            experience.getEntreprise(),
            experience.getPoste(),
            experience.getPosteEn(),
            experience.getContexte(),
            experience.getContexteEn(),
            experience.getDateDebut(),
            experience.getDateFin(),
            experience.getDateFin() == null,
            experience.getDescription(),
            experience.getDescriptionEn(),
            new ArrayList<>(experience.getRealisations()),
            new ArrayList<>(experience.getRealisationsEn()),
            new ArrayList<>(experience.getStack()),
            experience.getOrdreAffichage(),
            experience.getCreatedAt(),
            experience.getUpdatedAt()
        );
    }

    public List<ExperienceResponse> toResponseList(List<Experience> experiences) {
        return experiences.stream().map(this::toResponse).toList();
    }
}
