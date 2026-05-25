package com.portfolio.backend.security;

import com.portfolio.backend.repository.UserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implémentation de UserDetailsService pour Spring Security.
 *
 * <p>Spring Security appelle loadUserByUsername() lors de l'authentification.
 * Ici, le "username" est l'email de l'utilisateur.
 *
 * <p>@Transactional(readOnly = true) :
 * - readOnly : optimisation Hibernate (pas de dirty checking)
 * - Ouvre une transaction pour charger les collections LAZY si nécessaire
 */
@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    public UserDetailsServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        return userRepository.findByEmail(email)
            .orElseThrow(() -> new UsernameNotFoundException(
                "Utilisateur introuvable avec l'email : " + email
            ));
    }
}
