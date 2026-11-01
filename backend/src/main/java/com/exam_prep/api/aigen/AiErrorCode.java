package com.exam_prep.api.aigen;

/** Stable error codes. English defaults here; translations live in the frontend under aiGen.errors.*. */
public enum AiErrorCode {
    AI_DISABLED("AI question generation is currently unavailable."),
    AI_NOT_CONFIGURED("AI generation is not fully configured: check the provider, API key and pricing in the settings."),
    AI_ENCRYPTION_UNAVAILABLE("AI_SETTINGS_ENCRYPTION_KEY is missing or invalid on the server, so API keys cannot be stored or read."),
    AI_KEY_UNREADABLE("The stored API key cannot be decrypted. Enter the key again in the settings."),
    AI_INVALID_SETTING("Invalid AI setting value."),
    AI_PRICING_UNKNOWN("There is no known price for this model. Set the custom input and output prices so that the spend cap can be enforced."),
    AI_CONSENT_REQUIRED("You must accept that the file is sent to the external AI provider."),
    AI_FILE_MISSING("Select a PDF file."),
    AI_FILE_NOT_PDF("The file is not a valid PDF."),
    AI_FILE_TOO_LARGE("The PDF exceeds the 32 MB limit."),
    AI_TOO_MANY_PAGES("The PDF exceeds the 100 page limit."),
    AI_TOO_MUCH_TEXT("The PDF contains too much text. Try a shorter document."),
    AI_PDF_ENCRYPTED("The PDF is password-protected. Remove the password and try again."),
    AI_QUOTA_EXCEEDED("You have reached your AI generation limit for this period."),
    AI_SPEND_CAP_REACHED("AI generation is paused until the start of next month. This attempt did not use any of your generations."),
    AI_RATE_LIMITED("Too many generation requests. Wait a while and try again."),
    AI_JOB_ACTIVE("You already have a generation in progress."),
    AI_RETRY_LIMIT("This generation has reached the retry limit. Start a new one."),
    AI_INVALID_STATE("This action is not available in the current state of the generation."),
    AI_TOO_MANY_QUESTIONS("A generation can save at most 10 questions."),
    AI_INVALID_QUESTION("One of the questions is invalid."),
    AI_BUSY("The server is busy. Try again in a few minutes."),
    AI_REFUSED("The AI provider declined to process this document. Try a different document."),
    AI_TRUNCATED("The answer was cut off before finishing. Try a shorter document."),
    AI_OUTPUT_INVALID("The AI returned an invalid result. Try again."),
    AI_INTERRUPTED("The generation was interrupted. Try again."),
    AI_PROVIDER_AUTH("The AI provider rejected the API key."),
    AI_PROVIDER_PERMISSION("The API key does not have permission to use this model."),
    AI_PROVIDER_MODEL_NOT_FOUND("The AI provider does not recognise the configured model."),
    AI_PROVIDER_RATE_LIMIT("The AI provider is rate limiting requests. Try again shortly."),
    AI_PROVIDER_BAD_REQUEST("The AI provider rejected the request. The document may not be supported."),
    AI_PROVIDER_UNAVAILABLE("The AI provider is temporarily unavailable. Try again shortly."),
    AI_PROVIDER_CONNECTION("Could not connect to the AI provider. Try again shortly."),
    AI_PROVIDER_ERROR("The AI provider returned an unexpected error."),
    AI_INTERNAL("Something went wrong while generating the questions. Try again.");

    private final String message;

    AiErrorCode(String message) {
        this.message = message;
    }

    public String message() {
        return message;
    }
}
