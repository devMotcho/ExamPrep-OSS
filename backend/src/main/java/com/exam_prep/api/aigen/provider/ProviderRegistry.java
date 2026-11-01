package com.exam_prep.api.aigen.provider;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class ProviderRegistry {

    private final List<QuestionGenerationProvider> providers;

    public ProviderRegistry(List<QuestionGenerationProvider> providers) {
        this.providers = providers;
    }

    public Optional<QuestionGenerationProvider> find(String id) {
        return providers.stream().filter(p -> p.id().equals(id)).findFirst();
    }
}
