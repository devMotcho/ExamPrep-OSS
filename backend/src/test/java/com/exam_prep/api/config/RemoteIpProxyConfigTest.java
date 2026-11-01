package com.exam_prep.api.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.web.embedded.EmbeddedWebServerFactoryCustomizerAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.DispatcherServletAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.ServletWebServerFactoryAutoConfiguration;
import org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.SystemEnvironmentPropertySource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Starts real Tomcat, with the setting supplied the way Docker supplies it: as an environment variable. */
class RemoteIpProxyConfigTest {

    @Configuration
    @ImportAutoConfiguration({ServletWebServerFactoryAutoConfiguration.class, EmbeddedWebServerFactoryCustomizerAutoConfiguration.class,
            DispatcherServletAutoConfiguration.class, WebMvcAutoConfiguration.class})
    @RestController
    static class App {
        @GetMapping("/ip")
        String ip(HttpServletRequest request) {
            return request.getRemoteAddr();
        }
    }

    private String remoteAddrWith(String internalProxies) throws Exception {
        SpringApplicationBuilder builder = new SpringApplicationBuilder(App.class)
                .web(WebApplicationType.SERVLET)
                .properties("server.port=0", "server.forward-headers-strategy=native",
                        "spring.config.location=optional:classpath:/none/")
                .initializers(context -> context.getEnvironment().getPropertySources().addFirst(
                        new SystemEnvironmentPropertySource("test-systemEnvironment",
                                Map.of("SERVER_TOMCAT_REMOTEIP_INTERNAL_PROXIES", internalProxies))));
        try (ConfigurableApplicationContext context = builder.run()) {
            int port = ((ServletWebServerApplicationContext) context).getWebServer().getPort();
            HttpRequest request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/ip"))
                    .header("X-Forwarded-For", "203.0.113.9").build();
            return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString()).body();
        }
    }

    @Test
    void forwardedAddressIsUsedOnlyWhenTheProxyMatches() throws Exception {
        assertEquals("203.0.113.9", remoteAddrWith("127\\.0\\.0\\.1"));
        assertEquals("127.0.0.1", remoteAddrWith("10\\.9\\.9\\.9"));
    }
}
