package com.exam_prep.api.aigen.provider;

public record GenerationOutcome(Stop stop, String text, long inputTokens, long outputTokens) {

    public enum Stop { COMPLETE, REFUSED, TRUNCATED }

    @Override
    public String toString() {
        return "GenerationOutcome[stop=" + stop + ", in=" + inputTokens + ", out=" + outputTokens + "]";
    }
}
