package com.exam_prep.api.blog;

import com.exam_prep.api.blog.BlogDtos.MediaResponse;
import com.exam_prep.api.blog.BlogDtos.PostDetail;
import com.exam_prep.api.blog.BlogDtos.PostRequest;
import com.exam_prep.api.blog.BlogDtos.PostSummary;
import com.exam_prep.api.entity.SiteConfigEntity;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.repository.SiteConfigRepository;
import com.exam_prep.api.service.S3Service;
import com.exam_prep.api.user.UserEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.exception.SdkException;

import java.io.IOException;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BlogService {

    private static final String MEDIA_PREFIX = "blog-media/";
    private static final Set<String> ALLOWED_MEDIA = Set.of(
            "video/mp4", "video/webm", "image/png", "image/jpeg", "image/webp", "image/gif");
    private static final int WORDS_PER_MINUTE = 200;

    private final BlogPostRepository posts;
    private final S3Service s3Service;
    private final SiteConfigRepository siteConfigRepository;

    @Transactional(readOnly = true)
    public List<PostSummary> listPublished(String locale, String feature) {
        String lang = requireLocale(locale);
        List<BlogPostEntity> found = feature == null || feature.isBlank()
                ? posts.findByLocaleAndStatusOrderByPublishedAtDesc(lang, BlogPostEntity.PUBLISHED)
                : posts.findByLocaleAndStatusAndFeatureKeyOrderByPublishedAtDesc(lang, BlogPostEntity.PUBLISHED, feature);
        return found.stream().map(this::summary).toList();
    }

    @Transactional(readOnly = true)
    public PostDetail getPublished(String locale, String slug) {
        BlogPostEntity post = posts.findBySlugAndLocaleAndStatus(slug, requireLocale(locale), BlogPostEntity.PUBLISHED)
                .orElseThrow(BlogService::notFound);
        return detail(post);
    }

    @Transactional(readOnly = true)
    public List<PostSummary> listAll() {
        return posts.findAllByOrderByUpdatedAtDesc().stream().map(this::summary).toList();
    }

    @Transactional(readOnly = true)
    public PostDetail get(UUID id) {
        return detail(posts.findById(id).orElseThrow(BlogService::notFound));
    }

    private String siteName() {
        return siteConfigRepository.findById("company_name")
                .map(SiteConfigEntity::getValue)
                .filter(name -> !name.isBlank())
                .orElse("ExamPrep");
    }

    @Transactional
    public PostDetail create(PostRequest request, UserEntity author) {
        if (posts.existsBySlugAndLocale(request.slug(), request.locale())) {
            throw slugTaken();
        }
        BlogPostEntity post = BlogPostEntity.builder()
                .authorId(author.getId())
                .authorName(author.getName() == null || author.getName().isBlank() ? siteName() : author.getName())
                .build();
        apply(post, request);
        return detail(posts.save(post));
    }

    @Transactional
    public PostDetail update(UUID id, PostRequest request) {
        BlogPostEntity post = posts.findById(id).orElseThrow(BlogService::notFound);
        if (posts.existsBySlugAndLocaleAndIdNot(request.slug(), request.locale(), id)) {
            throw slugTaken();
        }
        apply(post, request);
        return detail(posts.save(post));
    }

    @Transactional
    public void delete(UUID id) {
        posts.delete(posts.findById(id).orElseThrow(BlogService::notFound));
    }

    public MediaResponse uploadMedia(MultipartFile file) {
        if (file == null || file.isEmpty() || !ALLOWED_MEDIA.contains(file.getContentType())) {
            throw new AppException("Use an MP4 or WebM video, or a PNG, JPEG, WebP or GIF image.", HttpStatus.BAD_REQUEST);
        }
        UUID id = UUID.randomUUID();
        try {
            s3Service.uploadFile(file, MEDIA_PREFIX + id);
        } catch (IllegalStateException e) {
            throw new AppException("File storage is not configured. Set up S3 in Settings.", HttpStatus.SERVICE_UNAVAILABLE);
        } catch (IOException | SdkException e) {
            throw new AppException("Could not store the file.", HttpStatus.BAD_GATEWAY);
        }
        // No file extension: nginx serves any URL ending in .mp4 as a static asset.
        return new MediaResponse("/api/blog/media/" + id, file.getContentType());
    }

    public String mediaUrl(UUID id) {
        String url = s3Service.generatePresignedUrl(MEDIA_PREFIX + id);
        if (url == null) {
            throw notFound();
        }
        return url;
    }

    private void apply(BlogPostEntity post, PostRequest request) {
        String excerpt = request.excerpt() == null ? "" : request.excerpt().trim();
        String content = request.contentMd() == null ? "" : request.contentMd();
        boolean publishing = BlogPostEntity.PUBLISHED.equals(request.status());
        if (publishing && (excerpt.isEmpty() || content.isBlank())) {
            throw new AppException("A published post needs a summary and content.", HttpStatus.BAD_REQUEST);
        }
        post.setTitle(request.title().trim());
        post.setSlug(request.slug());
        post.setLocale(request.locale());
        post.setExcerpt(excerpt);
        post.setContentMd(content);
        post.setFeatureKey(request.featureKey() == null || request.featureKey().isBlank() ? null : request.featureKey());
        post.setCoverUrl(request.coverUrl() == null || request.coverUrl().isBlank() ? null : request.coverUrl());
        post.setStatus(request.status());
        if (publishing && post.getPublishedAt() == null) {
            post.setPublishedAt(ZonedDateTime.now());
        }
    }

    private PostSummary summary(BlogPostEntity p) {
        return new PostSummary(p.getId(), p.getSlug(), p.getLocale(), p.getTitle(), p.getExcerpt(), p.getFeatureKey(),
                p.getStatus(), p.getAuthorName(), readingMinutes(p.getContentMd()), p.getPublishedAt(), p.getUpdatedAt(), p.getCoverUrl());
    }

    private PostDetail detail(BlogPostEntity p) {
        List<String> translations = posts.findBySlugAndStatus(p.getSlug(), BlogPostEntity.PUBLISHED).stream()
                .map(BlogPostEntity::getLocale)
                .filter(locale -> !locale.equals(p.getLocale()))
                .toList();
        return new PostDetail(p.getId(), p.getSlug(), p.getLocale(), p.getTitle(), p.getExcerpt(), p.getContentMd(),
                p.getFeatureKey(), p.getStatus(), p.getAuthorName(), readingMinutes(p.getContentMd()),
                p.getPublishedAt(), p.getUpdatedAt(), translations, p.getCoverUrl());
    }

    private static int readingMinutes(String content) {
        if (content == null || content.isBlank()) {
            return 1;
        }
        return Math.max(1, Math.round((float) content.trim().split("\\s+").length / WORDS_PER_MINUTE));
    }

    private static String requireLocale(String locale) {
        if (!"pt".equals(locale) && !"en".equals(locale)) {
            throw new AppException("Unknown language.", HttpStatus.BAD_REQUEST);
        }
        return locale;
    }

    private static AppException notFound() {
        return new AppException("Post not found.", HttpStatus.NOT_FOUND);
    }

    private static AppException slugTaken() {
        return new AppException("This address is already used in this language.", HttpStatus.CONFLICT);
    }
}
