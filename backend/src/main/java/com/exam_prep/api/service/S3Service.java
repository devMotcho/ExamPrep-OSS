package com.exam_prep.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.exam_prep.api.config.ServiceSettings;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.http.ContentStreamProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.utils.IoUtils;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Duration;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import java.net.URI;

@Service
@RequiredArgsConstructor
@Slf4j
public class S3Service {

    private static final String DEFAULT_REGION = "us-east-1";

    /** The keys this app creates: gallery/&lt;uuid&gt;[.ext] and blog-media/&lt;uuid&gt;. Nothing else may be presigned from a URL. */
    private static final Pattern OWN_KEY = Pattern.compile(
            "(gallery/[0-9a-fA-F-]{36}(\\.[A-Za-z0-9]{1,10})?|blog-media/[0-9a-fA-F-]{36})");

    private final ServiceSettings serviceSettings;

    /** The address browsers use for an S3-compatible server, when it differs from the one this server uses. */
    @Value("${aws.s3.public-endpoint:}")
    private String publicEndpoint;

    private String getConfigValue(String key) {
        return serviceSettings.resolve(key);
    }

    private boolean isS3Configured() {
        String accessKey = getConfigValue("s3_access_key");
        String secretKey = getConfigValue("s3_secret_key");
        String region = getConfigValue("s3_region");
        String bucket = getConfigValue("s3_bucket");
        return accessKey != null && !accessKey.isBlank() &&
                secretKey != null && !secretKey.isBlank() &&
                ((region != null && !region.isBlank()) || customEndpoint() != null) &&
                bucket != null && !bucket.isBlank();
    }

    /** Set for an S3-compatible server such as MinIO, which is then addressed with path-style URLs. */
    private URI customEndpoint() {
        String endpoint = getConfigValue("s3_endpoint");
        return endpoint == null || endpoint.isBlank() ? null : URI.create(endpoint.trim());
    }

    /** Only meaningful with a custom endpoint: on AWS, server calls and browsers use the same address. */
    private URI browserEndpoint() {
        URI server = customEndpoint();
        if (server == null) {
            return null;
        }
        return publicEndpoint == null || publicEndpoint.isBlank() ? server : URI.create(publicEndpoint.trim());
    }

    /** S3-compatible servers usually ignore the region, but request signing still needs one. */
    private Region region() {
        String region = getConfigValue("s3_region");
        return Region.of(region == null || region.isBlank() ? DEFAULT_REGION : region.trim());
    }

    private S3Client buildS3Client() {
        S3ClientBuilder builder = S3Client.builder()
                .region(region())
                .httpClientBuilder(UrlConnectionHttpClient.builder())
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(getConfigValue("s3_access_key"), getConfigValue("s3_secret_key"))
                ));
        URI endpoint = customEndpoint();
        if (endpoint != null) {
            // Cloudflare R2 refuses the signature of a chunked upload with a 403.
            builder.endpointOverride(endpoint)
                    .serviceConfiguration(S3Configuration.builder()
                            .pathStyleAccessEnabled(true)
                            .chunkedEncodingEnabled(false)
                            .build());
        }
        return builder.build();
    }

    private S3Presigner buildS3Presigner() {
        S3Presigner.Builder builder = S3Presigner.builder()
                .region(region())
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(getConfigValue("s3_access_key"), getConfigValue("s3_secret_key"))
                ));
        // The host is part of the signature, so a URL must be signed for the address the browser will call.
        URI endpoint = browserEndpoint();
        if (endpoint != null) {
            builder.endpointOverride(endpoint)
                    .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build());
        }
        return builder.build();
    }

    /** Stores an image under a generated key. The extension and type come from what the bytes turned out to be. */
    public String uploadImage(MultipartFile file, MediaTypes.Detected type) throws IOException {
        String s3Key = "gallery/" + UUID.randomUUID() + "." + type.extension();
        uploadFile(file, s3Key, type.contentType());
        return s3Key;
    }

    public void uploadFile(MultipartFile file, String s3Key, String contentType) throws IOException {
        if (!isS3Configured()) {
            throw new IllegalStateException("S3 is not fully configured in settings.");
        }

        // The SDK reads the body to sign it, again to send it, and again on a retry: each read needs a fresh stream.
        InputStream[] current = new InputStream[1];
        ContentStreamProvider source = () -> {
            IoUtils.closeQuietly(current[0], log);
            try {
                current[0] = file.getInputStream();
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
            return current[0];
        };

        try (S3Client s3Client = buildS3Client()) {
            PutObjectRequest putOb = PutObjectRequest.builder()
                    .bucket(getConfigValue("s3_bucket"))
                    .key(s3Key)
                    .contentType(contentType)
                    .build();

            s3Client.putObject(putOb, RequestBody.fromContentProvider(source, file.getSize(), contentType));
        } finally {
            IoUtils.closeQuietly(current[0], log);
        }
    }

    public void deleteFile(String s3Key) {
        if (!isS3Configured()) {
            return;
        }
        String bucket = getConfigValue("s3_bucket");
        try (S3Client s3Client = buildS3Client()) {
            DeleteObjectRequest delOb = DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(s3Key)
                    .build();
            s3Client.deleteObject(delOb);
        } catch (Exception e) {
            log.error("Failed to delete S3 object: {}", s3Key, e);
        }
    }

    public String generatePresignedUrl(String s3Key) {
        if (!isS3Configured()) {
            return null;
        }
        String bucket = getConfigValue("s3_bucket");
        try (S3Presigner presigner = buildS3Presigner()) {
            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofMinutes(60))
                    .getObjectRequest(b -> b.bucket(bucket).key(s3Key))
                    .build();

            PresignedGetObjectRequest presignedRequest = presigner.presignGetObject(presignRequest);
            return presignedRequest.url().toString();
        } catch (Exception e) {
            log.error("Failed to generate presigned URL for S3 key: {}", s3Key, e);
            return null;
        }
    }

    /**
     * Re-signs a stored image URL whose signature may have expired. Image URLs come from users, so only a URL
     * for this app's bucket and one of its own upload keys is signed; anything else is returned untouched.
     */
    public String refreshPresignedUrlIfNeeded(String urlString) {
        if (urlString == null || !urlString.startsWith("http") || !isS3Configured()) {
            return urlString;
        }

        try {
            String key = ownKeyFrom(new URI(urlString));
            if (key != null) {
                String newUrl = generatePresignedUrl(key);
                if (newUrl != null) {
                    return newUrl;
                }
            }
        } catch (Exception e) {
            // Not the URL itself: it can carry a signature.
            log.warn("Failed to parse or refresh an S3 URL: {}", e.getMessage());
        }

        return urlString;
    }

    /** Whether this URL points at one of this app's uploads, which may then be stored whatever its scheme. */
    public boolean isOwnObjectUrl(String urlString) {
        if (urlString == null || !isS3Configured()) {
            return false;
        }
        try {
            return ownKeyFrom(new URI(urlString)) != null;
        } catch (Exception e) {
            return false;
        }
    }

    /** The object key if this URL points at one of this app's uploads in its own bucket, otherwise null. */
    private String ownKeyFrom(URI url) {
        String host = url.getHost();
        String path = url.getPath();
        if (host == null || path == null) {
            return null;
        }
        String bucket = getConfigValue("s3_bucket");
        String pathStylePrefix = "/" + bucket + "/";
        String key = null;

        URI server = customEndpoint();
        if (server != null) {
            if ((sameServer(server, url) || sameServer(browserEndpoint(), url)) && path.startsWith(pathStylePrefix)) {
                key = path.substring(pathStylePrefix.length());
            }
        } else if (host.toLowerCase(Locale.ROOT).endsWith(".amazonaws.com")) {
            String lowerHost = host.toLowerCase(Locale.ROOT);
            if (lowerHost.startsWith(bucket.toLowerCase(Locale.ROOT) + ".s3")) {
                key = path.startsWith("/") ? path.substring(1) : path;
            } else if (lowerHost.startsWith("s3") && path.startsWith(pathStylePrefix)) {
                key = path.substring(pathStylePrefix.length());
            }
        }
        // getPath() has decoded the URL, so an encoded "../" cannot slip past this.
        return key != null && OWN_KEY.matcher(key).matches() ? key : null;
    }

    private static boolean sameServer(URI endpoint, URI url) {
        return endpoint.getHost() != null && endpoint.getHost().equalsIgnoreCase(url.getHost()) && endpoint.getPort() == url.getPort();
    }
}
