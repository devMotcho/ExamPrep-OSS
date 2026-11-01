package com.exam_prep.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.exam_prep.api.user.UserEntity;
import com.exam_prep.api.user.UserRepository;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserEntity findByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public UserEntity createUser(String name, String email, String phone, String rawPassword) {
        if (userRepository.existsByEmail(email)) {
            throw new RuntimeException("Email already exists");
        }
        UserEntity user = UserEntity.builder()
                .name(name)
                .email(email)
                .phone(phone)
                .password(passwordEncoder.encode(rawPassword))
                .role("ROLE_USER")
                .isActive(true)
                .build();
        return userRepository.save(user);
    }
    
    public void updateLastLogin(UserEntity user) {
        user.setLastLoginAt(java.time.ZonedDateTime.now());
        userRepository.save(user);
    }
    
    public boolean verifyPassword(String rawPassword, String encodedPassword) {
        return passwordEncoder.matches(rawPassword, encodedPassword);
    }

    public UserEntity findById(java.util.UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public void confirmEmail(String email) {
        UserEntity user = findByEmail(email);
        user.setConfirmed(true);
        userRepository.save(user);
    }

    public UserEntity save(UserEntity user) {
        return userRepository.save(user);
    }
}
