package com.exam_prep.api.blog;

import com.exam_prep.api.blog.BlogDtos.MediaResponse;
import com.exam_prep.api.blog.BlogDtos.PostDetail;
import com.exam_prep.api.blog.BlogDtos.PostRequest;
import com.exam_prep.api.blog.BlogDtos.PostSummary;
import com.exam_prep.api.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/blog")
@RequiredArgsConstructor
public class BlogController {

    private final BlogService service;
    private final UserService userService;

    // A malformed id cannot match anything, so it is reported like any other unknown id.
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Void> malformedId() {
        return ResponseEntity.notFound().build();
    }

    // Public: see SecurityConfig. Only published posts leave these endpoints.

    @GetMapping("/posts")
    public List<PostSummary> list(@RequestParam(defaultValue = "pt") String locale, @RequestParam(required = false) String feature) {
        return service.listPublished(locale, feature);
    }

    @GetMapping("/posts/{locale}/{slug}")
    public PostDetail get(@PathVariable String locale, @PathVariable String slug) {
        return service.getPublished(locale, slug);
    }

    @GetMapping("/media/{id}")
    public ResponseEntity<Void> media(@PathVariable UUID id) {
        // The presigned link lasts an hour, so the redirect is cached for less than that.
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, service.mediaUrl(id))
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(30)).cachePublic())
                .build();
    }

    // Developer only: writing and drafts.

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_DEV')")
    @GetMapping("/manage/posts")
    public List<PostSummary> listAll() {
        return service.listAll();
    }

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_DEV')")
    @GetMapping("/manage/posts/{id}")
    public PostDetail getForEditing(@PathVariable UUID id) {
        return service.get(id);
    }

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_DEV')")
    @PostMapping("/manage/posts")
    public ResponseEntity<PostDetail> create(@Valid @RequestBody PostRequest request, Principal principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.create(request, userService.findByEmail(principal.getName())));
    }

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_DEV')")
    @PutMapping("/manage/posts/{id}")
    public PostDetail update(@PathVariable UUID id, @Valid @RequestBody PostRequest request) {
        return service.update(id, request);
    }

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_DEV')")
    @DeleteMapping("/manage/posts/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_DEV')")
    @PostMapping("/manage/media")
    public MediaResponse upload(@RequestParam("file") MultipartFile file) {
        return service.uploadMedia(file);
    }
}
