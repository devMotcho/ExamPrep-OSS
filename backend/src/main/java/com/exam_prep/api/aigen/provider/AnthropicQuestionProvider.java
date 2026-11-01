package com.exam_prep.api.aigen.provider;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.JsonValue;
import com.anthropic.core.http.StreamResponse;
import com.anthropic.errors.AnthropicException;
import com.anthropic.errors.AnthropicIoException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.BadRequestException;
import com.anthropic.errors.InternalServerException;
import com.anthropic.errors.NotFoundException;
import com.anthropic.errors.PermissionDeniedException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.errors.UnauthorizedException;
import com.anthropic.errors.UnprocessableEntityException;
import com.anthropic.helpers.MessageAccumulator;
import com.anthropic.models.messages.Base64PdfSource;
import com.anthropic.models.messages.ContentBlockParam;
import com.anthropic.models.messages.DocumentBlockParam;
import com.anthropic.models.messages.JsonOutputFormat;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.RawMessageStreamEvent;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.TextBlockParam;
import com.exam_prep.api.aigen.AiErrorCode;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * Claude via the official Java SDK. No temperature/top_p and no thinking config are
 * sent (adaptive thinking is always on for the default model). Refusals surface as a
 * user error: the server-side fallback's Java builder is not documented in the SDK
 * reference, so it is not used.
 */
@Service
public class AnthropicQuestionProvider implements QuestionGenerationProvider {

    private static final Duration TIMEOUT = Duration.ofMinutes(10);

    @Override
    public String id() {
        return "anthropic";
    }

    @Override
    public String defaultModel() {
        return "claude-opus-5-5";
    }

    /** Overridable seam so the client can be pointed elsewhere in tests. */
    protected AnthropicClient newClient(String apiKey) {
        return AnthropicOkHttpClient.builder().apiKey(apiKey).timeout(TIMEOUT).maxRetries(1).build();
    }

    @Override
    public GenerationOutcome generate(String apiKey, GenerationRequest request, ProgressListener progress) {
        JsonOutputFormat.Schema.Builder schema = JsonOutputFormat.Schema.builder();
        request.jsonSchema().forEach((k, v) -> schema.putAdditionalProperty(k, JsonValue.from(v)));

        MessageCreateParams params = MessageCreateParams.builder()
                .model(request.model())
                .maxTokens(request.maxOutputTokens())
                .system(request.systemPrompt())
                .outputConfig(OutputConfig.builder()
                        .effort(OutputConfig.Effort.HIGH)
                        .format(JsonOutputFormat.builder().schema(schema.build()).build())
                        .build())
                .addUserMessageOfBlockParams(List.of(
                        ContentBlockParam.ofDocument(DocumentBlockParam.builder()
                                .source(Base64PdfSource.builder()
                                        .data(Base64.getEncoder().encodeToString(request.pdf()))
                                        .build())
                                .build()),
                        ContentBlockParam.ofText(TextBlockParam.builder().text(request.userPrompt()).build())))
                .build();

        AnthropicClient client = newClient(apiKey);
        try {
            MessageAccumulator accumulator = MessageAccumulator.create();
            AtomicLong characters = new AtomicLong();
            try (StreamResponse<RawMessageStreamEvent> stream = client.messages().createStreaming(params)) {
                stream.stream().forEach(event -> {
                    accumulator.accumulate(event);
                    event.contentBlockDelta()
                            .flatMap(delta -> delta.delta().text())
                            .ifPresent(text -> progress.onOutputCharacters(characters.addAndGet(text.text().length())));
                });
            }
            Message message = accumulator.message();
            long in = message.usage().inputTokens();
            long out = message.usage().outputTokens();
            StopReason stop = message.stopReason().orElse(null);
            if (StopReason.REFUSAL.equals(stop)) {
                return new GenerationOutcome(GenerationOutcome.Stop.REFUSED, "", in, out);
            }
            if (StopReason.MAX_TOKENS.equals(stop)) {
                return new GenerationOutcome(GenerationOutcome.Stop.TRUNCATED, "", in, out);
            }
            if (!StopReason.END_TURN.equals(stop)) {
                throw new ProviderCallException(AiErrorCode.AI_PROVIDER_ERROR, 0);
            }
            String text = message.content().stream()
                    .flatMap(block -> block.text().stream())
                    .map(block -> block.text())
                    .collect(Collectors.joining());
            return new GenerationOutcome(GenerationOutcome.Stop.COMPLETE, text, in, out);
        } catch (AnthropicException e) {
            throw translate(e);
        } finally {
            client.close();
        }
    }

    @Override
    public void testConnection(String apiKey, String model) {
        AnthropicClient client = newClient(apiKey);
        try {
            client.models().retrieve(model);
        } catch (AnthropicException e) {
            throw translate(e);
        } finally {
            client.close();
        }
    }

    private static ProviderCallException translate(AnthropicException e) {
        int status = e instanceof AnthropicServiceException s ? s.statusCode() : 0;
        AiErrorCode code;
        if (e instanceof UnauthorizedException) {
            code = AiErrorCode.AI_PROVIDER_AUTH;
        } else if (e instanceof PermissionDeniedException) {
            code = AiErrorCode.AI_PROVIDER_PERMISSION;
        } else if (e instanceof NotFoundException) {
            code = AiErrorCode.AI_PROVIDER_MODEL_NOT_FOUND;
        } else if (e instanceof RateLimitException) {
            code = AiErrorCode.AI_PROVIDER_RATE_LIMIT;
        } else if (e instanceof BadRequestException || e instanceof UnprocessableEntityException) {
            code = AiErrorCode.AI_PROVIDER_BAD_REQUEST;
        } else if (e instanceof InternalServerException) {
            code = AiErrorCode.AI_PROVIDER_UNAVAILABLE;
        } else if (e instanceof AnthropicIoException) {
            code = AiErrorCode.AI_PROVIDER_CONNECTION;
        } else {
            code = AiErrorCode.AI_PROVIDER_ERROR;
        }
        return new ProviderCallException(code, status);
    }
}
