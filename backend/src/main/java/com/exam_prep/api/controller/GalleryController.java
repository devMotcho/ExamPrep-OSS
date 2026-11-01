package com.exam_prep.api.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.exam_prep.api.dto.GalleryImageDto;
import com.exam_prep.api.dto.UpdateGalleryImageDto;
import com.exam_prep.api.entity.SiteConfigEntity;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.repository.SiteConfigRepository;
import com.exam_prep.api.service.GalleryService;
import com.exam_prep.api.service.UploadLimitService;
import com.exam_prep.api.service.UserService;
import com.exam_prep.api.user.UserEntity;

import java.io.IOException;
import java.security.Principal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/gallery")
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class GalleryController {

    private final GalleryService galleryService;
    private final SiteConfigRepository siteConfigRepository;
    private final UserService userService;
    private final UploadLimitService uploadLimitService;

    private boolean isFeatureEnabled(String key) {
        return siteConfigRepository.findById(key)
                .map(SiteConfigEntity::getValue)
                .map(Boolean::parseBoolean)
                .orElse(false);
    }

    private boolean isAuthenticated() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return false;
        }
        if (auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken) {
            return false;
        }
        return !"anonymousUser".equals(auth.getPrincipal());
    }

    private UserEntity getAuthenticatedUser(Principal principal) {
        if (principal == null) {
            throw new AppException("Unauthorized", HttpStatus.UNAUTHORIZED);
        }
        return userService.findByEmail(principal.getName());
    }



    @GetMapping
    public ResponseEntity<List<GalleryImageDto>> getImages(Principal principal) {
        if (!isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        
        if (!isFeatureEnabled("gallery_enabled")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        UserEntity user = getAuthenticatedUser(principal);
        return ResponseEntity.ok(galleryService.getImages(user));
    }

    @PostMapping
    public ResponseEntity<GalleryImageDto> uploadImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder", required = false) String folder,
            Principal principal) {
        if (!isFeatureEnabled("gallery_enabled")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        
        UserEntity user = getAuthenticatedUser(principal);
        uploadLimitService.enforce(file, user.getId());
        try {
            return ResponseEntity.ok(galleryService.uploadImage(file, user, folder));
        } catch (AppException e) {
            throw e;
        } catch (IllegalStateException e) {
            log.error("Gallery upload refused: {}", e.getMessage());
            throw new AppException("Image uploads are not available right now. Please try again later.", HttpStatus.SERVICE_UNAVAILABLE);
        } catch (Exception e) {
            log.error("Gallery upload failed", e);
            throw new AppException("We could not upload your image. Please try again.", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<GalleryImageDto> updateImage(@PathVariable UUID id, @jakarta.validation.Valid @RequestBody UpdateGalleryImageDto dto, Principal principal) {
        if (!isFeatureEnabled("gallery_enabled")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        
        UserEntity user = getAuthenticatedUser(principal);
        GalleryImageDto updated = null;
        if (dto.getFilename() != null) {
            updated = galleryService.renameImage(id, dto.getFilename(), user);
        }
        
        if (updated == null) {
            List<GalleryImageDto> list = galleryService.getImages(user);
            updated = list.stream()
                    .filter(img -> img.getId().equals(id))
                    .findFirst()
                    .orElseThrow(() -> new AppException("Image not found", HttpStatus.NOT_FOUND));
        }
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteImage(@PathVariable UUID id, Principal principal) {
        if (!isFeatureEnabled("gallery_enabled")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        
        UserEntity user = getAuthenticatedUser(principal);
        galleryService.deleteImage(id, user);
        return ResponseEntity.ok().build();
    }
}
