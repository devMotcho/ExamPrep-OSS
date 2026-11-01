package com.exam_prep.api.aigen.provider;

/** One implementation per external AI provider. The API key is passed per call and never retained. */
public interface QuestionGenerationProvider {

    /** Value of the ai_provider setting this implementation serves. */
    String id();

    String defaultModel();

    /**
     * Sends the PDF and returns the model's text plus token usage.
     *
     * @throws ProviderCallException on any API or network failure
     */
    GenerationOutcome generate(String apiKey, GenerationRequest request, ProgressListener progress);

    /**
     * Minimal authenticated call (fetches the model's metadata, generates nothing and costs nothing).
     *
     * @throws ProviderCallException when the key or the model is rejected
     */
    void testConnection(String apiKey, String model);

    @FunctionalInterface
    interface ProgressListener {
        void onOutputCharacters(long totalCharacters);
    }
}
