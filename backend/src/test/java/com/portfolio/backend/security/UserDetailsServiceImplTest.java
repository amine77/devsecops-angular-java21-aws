package com.portfolio.backend.security;

import com.portfolio.backend.entity.User;
import com.portfolio.backend.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserDetailsServiceImpl — Tests unitaires")
class UserDetailsServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserDetailsServiceImpl userDetailsService;

    @Test
    @DisplayName("Retourne l'utilisateur quand l'email existe")
    void shouldReturnUserWhenEmailExists() {
        User user = User.builder()
            .id(1L)
            .email("admin@portfolio.dev")
            .password("hashed")
            .firstName("Admin")
            .lastName("User")
            .build();

        given(userRepository.findByEmail("admin@portfolio.dev")).willReturn(Optional.of(user));

        UserDetails result = userDetailsService.loadUserByUsername("admin@portfolio.dev");

        assertThat(result).isNotNull();
        assertThat(result.getUsername()).isEqualTo("admin@portfolio.dev");
    }

    @Test
    @DisplayName("Lance UsernameNotFoundException quand l'email n'existe pas")
    void shouldThrowWhenEmailNotFound() {
        given(userRepository.findByEmail("unknown@test.com")).willReturn(Optional.empty());

        assertThatThrownBy(() -> userDetailsService.loadUserByUsername("unknown@test.com"))
            .isInstanceOf(UsernameNotFoundException.class)
            .hasMessageContaining("unknown@test.com");
    }
}
