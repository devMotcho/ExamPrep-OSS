package com.exam_prep.api.aigen.provider;

import java.util.Map;

public record GenerationRequest(String model, byte[] pdf, String systemPrompt, String userPrompt,
                                Map<String, Object> jsonSchema, long maxOutputTokens) {

    /** Must never expose the document or prompts through logs. */
    @Override
    public String toString() {
        return "GenerationRequest[model=" + model + "]";
    }
}
