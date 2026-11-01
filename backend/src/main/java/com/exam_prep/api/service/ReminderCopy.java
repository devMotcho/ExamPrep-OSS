package com.exam_prep.api.service;

import java.util.List;
import java.util.Locale;
import java.util.Set;

/** The wording of reminder emails and the unsubscribe pages, in the site's two languages. English is the default. */
public final class ReminderCopy {

    private static final Set<String> SUPPORTED = Set.of("en", "pt");

    private final boolean pt;

    private ReminderCopy(boolean pt) {
        this.pt = pt;
    }

    /** Anything other than a supported locale, including null, gives English. */
    public static ReminderCopy of(String locale) {
        return new ReminderCopy("pt".equals(locale));
    }

    public static boolean isSupported(String locale) {
        return SUPPORTED.contains(locale);
    }

    /** The first supported language in the header, in the client's order of preference, or null if there is none. */
    public static String fromAcceptLanguage(String header) {
        if (header == null || header.isBlank()) {
            return null;
        }
        try {
            List<Locale.LanguageRange> ranges = Locale.LanguageRange.parse(header);
            for (Locale.LanguageRange range : ranges) {
                String language = range.getRange().split("-")[0].toLowerCase(Locale.ROOT);
                if (SUPPORTED.contains(language)) {
                    return language;
                }
            }
        } catch (IllegalArgumentException e) {
            return null;
        }
        return null;
    }

    public String locale() {
        return pt ? "pt" : "en";
    }

    public String dashboardUrl(String frontendUrl) {
        return frontendUrl.replaceAll("/+$", "") + "/" + locale() + "/dashboard";
    }

    public String defaultSubject() {
        return pt ? "Está na hora de praticar" : "It's time to practise";
    }

    public String examSubject(String title, long days) {
        if (pt) {
            String when = days == 0 ? "é hoje" : days == 1 ? "é amanhã" : "é daqui a " + days + " dias";
            return "O teu exame de " + title + " " + when;
        }
        String when = days == 0 ? "is today" : days == 1 ? "is tomorrow" : "is in " + days + " days";
        return "Your " + title + " exam " + when;
    }

    public String goalLine(int dailyGoal) {
        if (pt) {
            String goal = dailyGoal == 1 ? "é 1 questão" : "são " + dailyGoal + " questões";
            return "O teu objetivo " + goal + " por dia. Bastam alguns minutos para não perderes o ritmo.";
        }
        String goal = dailyGoal == 1 ? "1 question" : dailyGoal + " questions";
        return "Your goal is " + goal + " a day. A few minutes is enough to keep your momentum.";
    }

    public String greeting(String name) {
        String hello = pt ? "Olá" : "Hello";
        return name != null && !name.isBlank()
                ? hello + ", " + name.trim().split("\\s+")[0] + "!"
                : hello + "!";
    }

    public String ctaLabel() {
        return pt ? "Praticar agora" : "Practise now";
    }

    public String footerText(String siteName) {
        return pt
                ? "Recebes este email porque ativaste os lembretes no " + siteName + "."
                : "You get this email because you turned on reminders on " + siteName + ".";
    }

    public String unsubscribeLabel() {
        return pt ? "Cancelar lembretes" : "Stop reminders";
    }

    public String unsubscribeQuestion() {
        return pt
                ? "Queres deixar de receber lembretes de estudo por email?"
                : "Do you want to stop getting study reminders by email?";
    }

    public String unsubscribedTitle() {
        return pt ? "Lembretes cancelados" : "Reminders stopped";
    }

    public String unsubscribedBody() {
        return pt
                ? "Já não vais receber lembretes de estudo por email."
                : "You will no longer get study reminders by email.";
    }

    public String invalidLinkTitle() {
        return pt ? "Ligação inválida" : "Invalid link";
    }

    public String invalidLinkBody() {
        return pt
                ? "Esta ligação não é válida. Podes desativar os lembretes no teu painel."
                : "This link is not valid. You can turn reminders off in your dashboard.";
    }

    public String dashboardLinkLabel() {
        return pt ? "Ir para o painel" : "Go to the dashboard";
    }
}
