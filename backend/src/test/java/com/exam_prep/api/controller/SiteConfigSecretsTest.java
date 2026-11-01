package com.exam_prep.api.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.exam_prep.api.aigen.AiSecretCipher;
import com.exam_prep.api.aigen.AiSettingsService;
import com.exam_prep.api.config.ServiceSettings;
import com.exam_prep.api.entity.SiteConfigEntity;
import com.exam_prep.api.exception.AppException;
import com.exam_prep.api.notification.email.DynamicMailSenderFactory;
import com.exam_prep.api.repository.SiteConfigRepository;
import com.exam_prep.api.service.S3Service;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpStatus;
import org.springframework.mock.env.MockEnvironment;

class SiteConfigSecretsTest {

    private static final String MASK = "********";

    private final Map<String, SiteConfigEntity> rows = new HashMap<>();
    private final SiteConfigRepository repo = mock(SiteConfigRepository.class);
    private final AiSettingsService aiSettings = mock(AiSettingsService.class);
    private final DynamicMailSenderFactory mail = mock(DynamicMailSenderFactory.class);
    private final MockEnvironment env = new MockEnvironment();
    private final SiteConfigController controller = new SiteConfigController(repo, mock(S3Service.class), aiSettings,
            new ServiceSettings(env, repo, new AiSecretCipher(new MockEnvironment())), mail);

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        row("smtp_host", "smtp.example.com", "string");
        row("smtp_port", "587", "string");
        row("smtp_username", "user", "string");
        row("smtp_password", "stored-password", "password");
        row("s3_endpoint", "https://s3.example.com", "string");
        row("s3_secret_key", "stored-secret", "password");
        row("s3_region", "eu-west-1", "string");
        row("company_name", "Acme", "string");
        when(repo.findById(anyString())).thenAnswer(i -> Optional.ofNullable(rows.get(i.getArgument(0, String.class))));
        when(repo.findAllById(any())).thenAnswer(i -> ((Collection<String>) i.getArgument(0)).stream()
                .filter(rows::containsKey).map(rows::get).toList());
        when(repo.saveAll(any())).thenAnswer(i -> i.getArgument(0));
        when(aiSettings.prepareForStorage(anyString(), any())).thenAnswer(i -> i.getArgument(1));
    }

    private void row(String key, String value, String type) {
        rows.put(key, SiteConfigEntity.builder().key(key).value(value).type(type).build());
    }

    private String value(String key) {
        return rows.get(key).getValue();
    }

    private void put(String key, String value) {
        controller.updateConfig(key, Map.of("value", value));
    }

    @ParameterizedTest
    @CsvSource({"smtp_host, smtp_password, stored-secret", "smtp_username, smtp_password, stored-secret"})
    void changingWhereMailGoesClearsThePassword(String key, String secret, String untouched) {
        put(key, "changed");
        assertEquals("changed", value(key));
        assertEquals("", value(secret));
        assertEquals(untouched, value("s3_secret_key"));
        verify(mail).invalidateCache();
    }

    @Test
    void changingTheEndpointClearsTheS3Secret() {
        put("s3_endpoint", "https://other.example.com");
        assertEquals("", value("s3_secret_key"));
        assertEquals("stored-password", value("smtp_password"));
        verify(mail, never()).invalidateCache();
    }

    @Test
    void aBulkSaveClearsToo() {
        controller.updateBulkConfig(Map.of("smtp_host", "changed", "s3_endpoint", "https://other.example.com"));
        assertEquals("", value("smtp_password"));
        assertEquals("", value("s3_secret_key"));
        verify(mail).invalidateCache();
    }

    @Test
    void theClearedRowIsSavedAndReturnedMasked() {
        List<SiteConfigEntity> result = controller.updateBulkConfig(Map.of("smtp_host", "changed")).getBody();
        assertEquals("", result.stream().filter(c -> c.getKey().equals("smtp_password")).findFirst().orElseThrow().getValue());
    }

    @Test
    void anUnchangedValueClearsNothing() {
        controller.updateBulkConfig(Map.of("smtp_host", "smtp.example.com", "smtp_username", "user", "s3_endpoint", "https://s3.example.com"));
        assertEquals("stored-password", value("smtp_password"));
        assertEquals("stored-secret", value("s3_secret_key"));
    }

    @Test
    void otherSettingsClearNothing() {
        controller.updateBulkConfig(Map.of("company_name", "Other", "s3_region", "us-east-1"));
        assertEquals("stored-password", value("smtp_password"));
        assertEquals("stored-secret", value("s3_secret_key"));
        verify(mail, never()).invalidateCache();
    }

    @Test
    void aNewPasswordInTheSameRequestIsKept() {
        controller.updateBulkConfig(Map.of("smtp_host", "changed", "smtp_password", "new-password"));
        assertEquals("changed", value("smtp_host"));
        assertEquals("new-password", value("smtp_password"));
    }

    @Test
    void theMaskDoesNotCountAsANewPassword() {
        controller.updateBulkConfig(Map.of("smtp_host", "changed", "smtp_password", MASK));
        assertEquals("", value("smtp_password"));
    }

    @ParameterizedTest
    @CsvSource({
            "SMTP_HOST, smtp_host", "SMTP_USERNAME, smtp_username", "SMTP_PASSWORD, smtp_host", "SMTP_PASSWORD, smtp_username",
            "AWS_S3_ENDPOINT, s3_endpoint", "AWS_S3_SECRET_KEY, s3_endpoint"})
    void theEnvironmentCannotBeRedirected(String envName, String key) {
        env.setProperty(envName, "from-env");
        String before = value(key);

        AppException e = assertThrows(AppException.class, () -> put(key, "changed"));

        assertEquals(HttpStatus.CONFLICT, e.getStatus());
        assertEquals(before, value(key));
        assertEquals("stored-password", value("smtp_password"));
        assertEquals("stored-secret", value("s3_secret_key"));
        verify(repo, never()).saveAll(any());
    }

    @Test
    void aRefusedValueLeavesTheWholeRequestUntouched() {
        env.setProperty("SMTP_HOST", "from-env");
        assertThrows(AppException.class, () -> controller.updateBulkConfig(Map.of("company_name", "Other", "smtp_host", "changed")));
        assertEquals("Acme", value("company_name"));
    }

    @Test
    void anUnchangedEnvironmentValueIsNotRefused() {
        env.setProperty("SMTP_HOST", "smtp.example.com");
        controller.updateBulkConfig(Map.of("smtp_host", "smtp.example.com", "company_name", "Other"));
        assertEquals("Other", value("company_name"));
    }

    @Test
    void anySmtpChangeRefreshesTheSender() {
        put("smtp_port", "2525");
        verify(mail).invalidateCache();
    }
}
