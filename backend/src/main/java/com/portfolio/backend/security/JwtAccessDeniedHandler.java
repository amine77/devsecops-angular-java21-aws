package com.portfolio.backend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@Component
public class JwtAccessDeniedHandler implements AccessDeniedHandler {

    private static final Logger log = LoggerFactory.getLogger(JwtAccessDeniedHandler.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void handle(
        HttpServletRequest request,
        HttpServletResponse response,
        AccessDeniedException accessDeniedException
    ) throws IOException, ServletException {
        log.error("Accès refusé pour: {}", request.getRequestURI());

        response.setContentType("application/json;charset=UTF-8");
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("success", false);
        errorResponse.put("status", 403);
        errorResponse.put("message", "Accès refusé");
        errorResponse.put("path", request.getRequestURI());

        response.getWriter().write(objectMapper.writeValueAsString(errorResponse));
    }
}
