package com.exam_prep.api.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.exam_prep.api.aigen.AiSecretCipher;
import com.exam_prep.api.entity.SiteConfigEntity;
import com.exam_prep.api.repository.SiteConfigRepository;
import java.util.Base64;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class ServiceSettingsTest {

    private static final String KEY = Base64.getEncoder().encodeToString(new byte[32]);

    private final SiteConfigRepository repo = mock(SiteConfigRepository.class);
    private final MockEnvironment env = new MockEnvironment();

    private ServiceSettings settings(boolean withCipher) {
        MockEnvironment cipherEnv = new MockEnvironment();
        if (withCipher) {
            cipherEnv.setProperty("AI_SETTINGS_ENCRYPTION_KEY", KEY);
        }
        return new ServiceSettings(env, repo, new AiSecretCipher(cipherEnv));
    }

    private void stored(String key, String value) {
        when(repo.findById(key)).thenReturn(Optional.of(SiteConfigEntity.builder().key(key).value(value).build()));
    }

    @Test
    void theEnvironmentComesFirst() {
        env.setProperty("AWS_S3_SECRET_KEY", "from-env");
        stored("s3_secret_key", "from-db");
        assertEquals("from-env", settings(false).resolve("s3_secret_key"));
    }

    @Test
    void aBlankEnvironmentValueDoesNotCount() {
        env.setProperty("SMTP_PASSWORD", " ");
        stored("smtp_password", "from-db");
        assertEquals("from-db", settings(false).resolve("smtp_password"));
    }

    @Test
    void theDefaultPortOnlyCountsWithAHostFromTheEnvironment() {
        env.setProperty("SMTP_PORT", "587");
        stored("smtp_port", "2525");
        assertEquals("2525", settings(false).resolve("smtp_port"));
        env.setProperty("SMTP_HOST", "mail.example.com");
        assertEquals("587", settings(false).resolve("smtp_port"));
    }

    @Test
    void secretsAreEncryptedWhenAKeyExists() {
        ServiceSettings settings = settings(true);
        String prepared = settings.prepareForStorage("smtp_password", "hunter2");
        assertNotEquals("hunter2", prepared);
        assertTrue(AiSecretCipher.isEncrypted(prepared));
        stored("smtp_password", prepared);
        assertEquals("hunter2", settings.resolve("smtp_password"));
        assertEquals(prepared, settings.prepareForStorage("smtp_password", prepared));
    }

    @Test
    void withoutAKeySecretsAreKeptAsEntered() {
        ServiceSettings settings = settings(false);
        assertEquals("hunter2", settings.prepareForStorage("smtp_password", "hunter2"));
        stored("smtp_password", "hunter2");
        assertEquals("hunter2", settings.resolve("smtp_password"));
    }

    @Test
    void otherSettingsPassThrough() {
        assertEquals("eu-west-1", settings(true).prepareForStorage("s3_region", "eu-west-1"));
    }

    @Test
    void theSeederClearsADatabaseSecretWhenTheEnvironmentHasIt() {
        env.setProperty("AWS_S3_SECRET_KEY", "from-env");
        SiteConfigEntity row = SiteConfigEntity.builder().key("s3_secret_key").value("from-db").build();
        when(repo.findById(any())).thenReturn(Optional.empty());
        when(repo.findById("s3_secret_key")).thenReturn(Optional.of(row));

        new EnvConfigSeeder(repo, env, settings(false)).run();

        assertEquals("", row.getValue());
        verify(repo).save(row);
    }

    @Test
    void theSeederDoesNotCopyASecretFromTheEnvironment() {
        env.setProperty("AWS_S3_SECRET_KEY", "from-env");
        when(repo.findById(any())).thenReturn(Optional.empty());
        SiteConfigEntity empty = SiteConfigEntity.builder().key("s3_secret_key").value("").build();
        when(repo.findById("s3_secret_key")).thenReturn(Optional.of(empty));

        new EnvConfigSeeder(repo, env, settings(false)).run();

        assertEquals("", empty.getValue());
        verify(repo, never()).save(any());
    }
}
