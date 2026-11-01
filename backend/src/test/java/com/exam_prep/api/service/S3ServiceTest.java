package com.exam_prep.api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.exam_prep.api.entity.SiteConfigEntity;
import com.exam_prep.api.repository.SiteConfigRepository;
import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class S3ServiceTest {

    private static final String UUID = "3f2b8c1e-7a4d-4e9b-9c11-0a1b2c3d4e5f";

    private final SiteConfigRepository repo = mock(SiteConfigRepository.class);
    private final S3Service service = new S3Service(repo);
    private final Map<String, String> config = new HashMap<>(Map.of(
            "s3_access_key", "key", "s3_secret_key", "secret", "s3_region", "us-east-1", "s3_bucket", "mine"));

    private void useConfig() {
        when(repo.findById(anyString())).thenAnswer(call -> Optional.ofNullable(config.get(call.<String>getArgument(0)))
                .map(value -> SiteConfigEntity.builder().value(value).build()));
    }

    private void useMinio() {
        config.put("s3_endpoint", "http://minio:9000");
        ReflectionTestUtils.setField(service, "publicEndpoint", "http://localhost:9000");
        useConfig();
    }

    private static boolean signed(String url) {
        return url.contains("X-Amz-Signature=");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "https://mine.s3.amazonaws.com/gallery/" + UUID + ".png",
            "https://mine.s3.eu-west-1.amazonaws.com/gallery/" + UUID + ".png?X-Amz-Signature=old",
            "https://s3.eu-west-1.amazonaws.com/mine/gallery/" + UUID,
            "https://mine.s3.amazonaws.com/blog-media/" + UUID})
    void signsTheAppsOwnKeys(String url) {
        useConfig();
        assertTrue(signed(service.refreshPresignedUrlIfNeeded(url)));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "https://mine.s3.amazonaws.com/backups/db.sql",
            "https://mine.s3.amazonaws.com/secret.txt",
            "https://mine.s3.amazonaws.com/gallery/",
            "https://mine.s3.amazonaws.com/gallery/../backups/db.sql",
            "https://mine.s3.amazonaws.com/gallery/%2e%2e/backups/db.sql",
            "https://mine.s3.amazonaws.com/gallery/" + UUID + "/../../backups/db.sql",
            "https://mine.s3.amazonaws.com/gallery/" + UUID + ".png/extra",
            "https://other.s3.amazonaws.com/gallery/" + UUID + ".png",
            "https://s3.amazonaws.com/other/gallery/" + UUID + ".png",
            "https://mine.s3.amazonaws.com.evil.example/gallery/" + UUID + ".png",
            "https://example.com/gallery/" + UUID + ".png"})
    void leavesEverythingElseUnsigned(String url) {
        useConfig();
        assertEquals(url, service.refreshPresignedUrlIfNeeded(url));
    }

    @Test
    void presignedUrlsUseThePublicEndpoint() {
        useMinio();
        URI url = URI.create(service.generatePresignedUrl("gallery/" + UUID + ".png"));
        assertEquals("localhost", url.getHost());
        assertEquals(9000, url.getPort());
        assertEquals("/mine/gallery/" + UUID + ".png", url.getPath());
    }

    @Test
    void presignedUrlsUseTheServerEndpointWithoutAPublicOne() {
        config.put("s3_endpoint", "http://minio:9000");
        useConfig();
        assertEquals("minio", URI.create(service.generatePresignedUrl("gallery/" + UUID)).getHost());
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://localhost:9000", "http://minio:9000"})
    void recognisesStoredUrlsFromEitherEndpoint(String base) {
        useMinio();
        String refreshed = service.refreshPresignedUrlIfNeeded(base + "/mine/gallery/" + UUID + ".png");
        assertTrue(signed(refreshed));
        assertEquals("localhost", URI.create(refreshed).getHost());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://localhost:9000/other/gallery/" + UUID + ".png",
            "http://localhost:9000/mine/backups/db.sql",
            "http://localhost:9001/mine/gallery/" + UUID + ".png"})
    void customEndpointStillRequiresOwnBucketKeyAndServer(String url) {
        useMinio();
        assertEquals(url, service.refreshPresignedUrlIfNeeded(url));
    }
}
