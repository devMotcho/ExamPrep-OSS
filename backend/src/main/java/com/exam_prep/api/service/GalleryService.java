package com.exam_prep.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.exam_prep.api.dto.ContentLimits;
import com.exam_prep.api.dto.GalleryImageDto;
import com.exam_prep.api.entity.GalleryImageEntity;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.repository.GalleryImageRepository;
import com.exam_prep.api.user.UserEntity;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class GalleryService {

    private final GalleryImageRepository galleryImageRepository;
    private final S3Service s3Service;

    public List<GalleryImageDto> getImages(UserEntity user) {
        if (user == null) {
            return List.of();
        }
        List<GalleryImageEntity> entities = galleryImageRepository.findByUploadedByIdOrderByUploadedAtDesc(user.getId());
        return entities.stream().map(this::mapToDto).collect(Collectors.toList());
    }

    @Transactional
    public GalleryImageDto uploadImage(MultipartFile file, UserEntity user, String folder) throws IOException {
        if (user == null) {
            throw new AppException("Unauthorized", HttpStatus.UNAUTHORIZED);
        }
        // The bytes decide, not the declared type or name. This excludes SVG, which can carry scripts.
        MediaTypes.Detected type = MediaTypes.detect(file).filter(MediaTypes.Detected::isImage)
                .orElseThrow(() -> new AppException("Only PNG, JPEG, WebP and GIF images can be uploaded.", HttpStatus.BAD_REQUEST));
        String s3Key = s3Service.uploadImage(file, type);

        GalleryImageEntity entity = GalleryImageEntity.builder()
                .filename(displayName(file.getOriginalFilename()))
                .s3Key(s3Key)
                .uploadedBy(user)
                .folder(folder == null || folder.length() <= ContentLimits.FOLDER ? folder : folder.substring(0, ContentLimits.FOLDER))
                .build();

        entity = galleryImageRepository.save(entity);
        return mapToDto(entity);
    }

    private static String displayName(String original) {
        if (original == null || original.isBlank()) {
            return "unnamed";
        }
        String base = original.replace('\\', '/');
        base = base.substring(base.lastIndexOf('/') + 1).replaceAll("\\p{Cntrl}", "");
        return base.length() > ContentLimits.FILENAME ? base.substring(base.length() - ContentLimits.FILENAME) : base;
    }

    @Transactional
    public GalleryImageDto renameImage(UUID id, String newFilename, UserEntity user) {
        GalleryImageEntity entity = galleryImageRepository.findById(id)
                .orElseThrow(() -> new AppException("Image not found", HttpStatus.NOT_FOUND));
        if (entity.getUploadedBy() == null || !entity.getUploadedBy().getId().equals(user.getId())) {
            throw new AppException("Access denied", HttpStatus.FORBIDDEN);
        }
        entity.setFilename(newFilename);
        return mapToDto(galleryImageRepository.save(entity));
    }



    @Transactional
    public void deleteImage(UUID id, UserEntity user) {
        GalleryImageEntity entity = galleryImageRepository.findById(id)
                .orElseThrow(() -> new AppException("Image not found", HttpStatus.NOT_FOUND));
        if (entity.getUploadedBy() == null || !entity.getUploadedBy().getId().equals(user.getId())) {
            throw new AppException("Access denied", HttpStatus.FORBIDDEN);
        }
        
        galleryImageRepository.delete(entity);
        s3Service.deleteFile(entity.getS3Key());
    }

    private GalleryImageDto mapToDto(GalleryImageEntity entity) {
        return GalleryImageDto.builder()
                .id(entity.getId())
                .filename(entity.getFilename())
                .folder(entity.getFolder())
                .uploadedAt(entity.getUploadedAt())
                .url(s3Service.generatePresignedUrl(entity.getS3Key()))
                .build();
    }
}
