package com.exam_prep.api.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

class ReminderCopyTest {

    @Test
    void defaultsToEnglish() {
        assertEquals("en", ReminderCopy.of(null).locale());
        assertEquals("en", ReminderCopy.of("fr").locale());
        assertEquals("It's time to practise", ReminderCopy.of(null).defaultSubject());
    }

    @Test
    void followsTheStoredLanguage() {
        assertEquals("Está na hora de praticar", ReminderCopy.of("pt").defaultSubject());
        assertEquals("O teu exame de Física é amanhã", ReminderCopy.of("pt").examSubject("Física", 1));
        assertEquals("Your Physics exam is in 3 days", ReminderCopy.of("en").examSubject("Physics", 3));
    }

    @ParameterizedTest
    @CsvSource({"pt,https://exam.example/,https://exam.example/pt/dashboard", "en,https://exam.example,https://exam.example/en/dashboard"})
    void linksUseFrontendUrlWithTheLocale(String locale, String frontend, String expected) {
        assertEquals(expected, ReminderCopy.of(locale).dashboardUrl(frontend));
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {"pt-PT,pt;q=0.9,en;q=0.8|pt", "en-GB,en;q=0.9|en", "fr-FR,pt;q=0.5|pt"})
    void readsTheFirstSupportedLanguageFromTheHeader(String header, String expected) {
        assertEquals(expected, ReminderCopy.fromAcceptLanguage(header));
    }

    @Test
    void headerWithoutASupportedLanguageGivesNothing() {
        assertNull(ReminderCopy.fromAcceptLanguage(null));
        assertNull(ReminderCopy.fromAcceptLanguage("fr-FR"));
        assertNull(ReminderCopy.fromAcceptLanguage("not;;a=header"));
    }

    @Test
    void englishTemplateHasNoPortuguese() {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setSuffix(".html");
        SpringTemplateEngine engine = new SpringTemplateEngine();
        engine.setTemplateResolver(resolver);

        ReminderCopy copy = ReminderCopy.of("en");
        Context context = new Context();
        context.setVariables(Map.of("lang", "en", "subject", copy.defaultSubject(), "greeting", copy.greeting("Ana Silva"),
                "lines", List.of(copy.goalLine(1)), "ctaUrl", copy.dashboardUrl("https://exam.example"), "ctaLabel", copy.ctaLabel(),
                "footerText", copy.footerText("ExamPrep"), "unsubscribeUrl", "https://api.example/u", "unsubscribeLabel", copy.unsubscribeLabel()));
        String html = engine.process("reminder-email", context);

        assertTrue(html.contains("lang=\"en\""));
        assertTrue(html.contains("Hello, Ana!"));
        assertTrue(html.contains("Your goal is 1 question a day"));
        assertTrue(html.contains("https://exam.example/en/dashboard"));
        assertTrue(html.contains("Practise now"));
        assertFalse(html.contains("Praticar"));
        assertFalse(html.contains("Recebes"));
    }
}
