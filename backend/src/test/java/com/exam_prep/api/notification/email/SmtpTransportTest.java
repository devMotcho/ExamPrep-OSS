package com.exam_prep.api.notification.email;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.exam_prep.api.aigen.AiSecretCipher;
import com.exam_prep.api.config.ServiceSettings;
import com.exam_prep.api.entity.SiteConfigEntity;
import com.exam_prep.api.notification.NotificationProperties;
import com.exam_prep.api.repository.SiteConfigRepository;
import java.util.Optional;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mock.env.MockEnvironment;

class SmtpTransportTest {

    private static Properties transport(int port, boolean credentials) {
        Properties props = new Properties();
        DynamicMailSenderFactory.applyTransportSecurity(props, port, credentials);
        return props;
    }

    @ParameterizedTest
    @ValueSource(ints = {25, 587, 2525})
    void starttlsPortsRequireIt(int port) {
        Properties props = transport(port, false);
        assertEquals("true", props.get("mail.smtp.starttls.enable"));
        assertEquals("true", props.get("mail.smtp.starttls.required"));
        assertNull(props.get("mail.smtp.ssl.enable"));
    }

    @Test
    void port465UsesTlsFromTheStart() {
        Properties props = transport(465, true);
        assertEquals("true", props.get("mail.smtp.ssl.enable"));
        assertNull(props.get("mail.smtp.starttls.enable"));
        assertNull(props.get("mail.smtp.starttls.required"));
    }

    @Test
    void aLocalCatcherWithoutCredentialsStillWorks() {
        assertEquals("false", transport(1025, false).get("mail.smtp.starttls.required"));
    }

    @Test
    void credentialsAreNeverSentWithoutTls() {
        assertEquals("true", transport(1025, true).get("mail.smtp.starttls.required"));
    }

    @Test
    void theServerNameIsChecked() {
        assertEquals("true", transport(587, true).get("mail.smtp.ssl.checkserveridentity"));
        assertEquals("true", transport(465, true).get("mail.smtp.ssl.checkserveridentity"));
    }

    @Test
    void theBuiltSenderCarriesTheseSettings() {
        JavaMailSenderImpl sender = (JavaMailSenderImpl) factory("mail.example.com", "465").getMailSender();
        assertEquals(465, sender.getPort());
        assertEquals("true", sender.getJavaMailProperties().get("mail.smtp.ssl.enable"));
    }

    private static DynamicMailSenderFactory factory(String host, String port) {
        SiteConfigRepository repo = mock(SiteConfigRepository.class);
        when(repo.findById(any())).thenReturn(Optional.empty());
        when(repo.findById("smtp_host")).thenAnswer(i -> Optional.of(SiteConfigEntity.builder().key("smtp_host").value(host).build()));
        when(repo.findById("smtp_port")).thenReturn(Optional.of(SiteConfigEntity.builder().key("smtp_port").value(port).build()));
        return new DynamicMailSenderFactory(new JavaMailSenderImpl(), new NotificationProperties(), repo,
                new ServiceSettings(new MockEnvironment(), repo, new AiSecretCipher(new MockEnvironment())));
    }

    @Configuration
    @EnableCaching
    static class CacheConfig {
        @Bean
        CacheManager cacheManager() {
            return new ConcurrentMapCacheManager("smtpMailSender");
        }

        @Bean
        DynamicMailSenderFactory factory() {
            return SmtpTransportTest.factory("mail.example.com", "587");
        }
    }

    @Test
    void invalidatingTheCacheBuildsANewSender() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext(CacheConfig.class)) {
            DynamicMailSenderFactory cached = context.getBean(DynamicMailSenderFactory.class);
            JavaMailSender first = cached.getMailSender();
            assertSame(first, cached.getMailSender());
            cached.invalidateCache();
            assertNotSame(first, cached.getMailSender());
        }
    }
}
