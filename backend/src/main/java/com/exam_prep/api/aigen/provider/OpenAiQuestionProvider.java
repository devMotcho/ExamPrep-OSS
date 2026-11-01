package com.exam_prep.api.aigen.provider;

import com.exam_prep.api.aigen.AiErrorCode;
import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.core.JsonValue;
import com.openai.core.http.StreamResponse;
import com.openai.errors.BadRequestException;
import com.openai.errors.InternalServerException;
import com.openai.errors.NotFoundException;
import com.openai.errors.OpenAIException;
import com.openai.errors.OpenAIIoException;
import com.openai.errors.OpenAIServiceException;
import com.openai.errors.PermissionDeniedException;
import com.openai.errors.RateLimitException;
import com.openai.errors.UnauthorizedException;
import com.openai.errors.UnprocessableEntityException;
import com.openai.models.responses.EasyInputMessage;
import com.openai.models.responses.Response;
import com.openai.models.responses.ResponseCreateParams;
import com.openai.models.responses.ResponseFormatTextJsonSchemaConfig;
import com.openai.models.responses.ResponseInputContent;
import com.openai.models.responses.ResponseInputFile;
import com.openai.models.responses.ResponseInputItem;
import com.openai.models.responses.ResponseInputText;
import com.openai.models.responses.ResponseOutputMessage;
import com.openai.models.responses.ResponseStatus;
import com.openai.models.responses.ResponseStreamEvent;
import com.openai.models.responses.ResponseTextConfig;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

/**
 * OpenAI via the official Java SDK: Responses API, base64 input_file before the text,
 * strict JSON schema output, and store=false so the response is not retained for later
 * retrieval. Default model and format verified against developers.openai.com/api/docs
 * (guides/pdf-files, models) on 2026-10-31.
 */
@Service
public class OpenAiQuestionProvider implements QuestionGenerationProvider {

    private static final Duration TIMEOUT = Duration.ofMinutes(10);

    @Override
    public String id() {
        return "openai";
    }

    @Override
    public String defaultModel() {
        return "gpt-6-astra";
    }

    /** Overridable seam so the client can be pointed elsewhere in tests. */
    protected OpenAIClient newClient(String apiKey) {
        return OpenAIOkHttpClient.builder().apiKey(apiKey).timeout(TIMEOUT).maxRetries(1).build();
    }

    @Override
    public GenerationOutcome generate(String apiKey, GenerationRequest request, ProgressListener progress) {
        ResponseFormatTextJsonSchemaConfig.Schema.Builder schema = ResponseFormatTextJsonSchemaConfig.Schema.builder();
        request.jsonSchema().forEach((k, v) -> schema.putAdditionalProperty(k, JsonValue.from(v)));

        EasyInputMessage userMessage = EasyInputMessage.builder()
                .role(EasyInputMessage.Role.USER)
                .contentOfResponseInputMessageContentList(List.of(
                        ResponseInputContent.ofInputFile(ResponseInputFile.builder()
                                .filename("document.pdf")
                                .fileData("data:application/pdf;base64," + Base64.getEncoder().encodeToString(request.pdf()))
                                .build()),
                        ResponseInputContent.ofInputText(ResponseInputText.builder().text(request.userPrompt()).build())))
                .build();

        ResponseCreateParams params = ResponseCreateParams.builder()
                .model(request.model())
                .instructions(request.systemPrompt())
                .input(ResponseCreateParams.Input.ofResponse(List.of(ResponseInputItem.ofEasyInputMessage(userMessage))))
                .maxOutputTokens(request.maxOutputTokens())
                .store(false)
                .text(ResponseTextConfig.builder()
                        .format(ResponseFormatTextJsonSchemaConfig.builder()
                                .name("generated_questions")
                                .schema(schema.build())
                                .strict(true)
                                .build())
                        .build())
                .build();

        OpenAIClient client = newClient(apiKey);
        try {
            AtomicLong characters = new AtomicLong();
            AtomicReference<Response> finalResponse = new AtomicReference<>();
            try (StreamResponse<ResponseStreamEvent> stream = client.responses().createStreaming(params)) {
                stream.stream().forEach(event -> {
                    event.outputTextDelta().ifPresent(delta ->
                            progress.onOutputCharacters(characters.addAndGet(delta.delta().length())));
                    event.completed().ifPresent(e -> finalResponse.set(e.response()));
                    event.incomplete().ifPresent(e -> finalResponse.set(e.response()));
                    event.failed().ifPresent(e -> finalResponse.set(e.response()));
                });
            }
            Response response = finalResponse.get();
            if (response == null) {
                throw new ProviderCallException(AiErrorCode.AI_PROVIDER_ERROR, 0);
            }
            return toOutcome(response);
        } catch (OpenAIException e) {
            throw translate(e);
        } finally {
            client.close();
        }
    }

    private static GenerationOutcome toOutcome(Response response) {
        long in = response.usage().map(u -> u.inputTokens()).orElse(0L);
        long out = response.usage().map(u -> u.outputTokens()).orElse(0L);
        StringBuilder text = new StringBuilder();
        boolean refused = false;
        for (var item : response.output()) {
            ResponseOutputMessage message = item.message().orElse(null);
            if (message == null) {
                continue;
            }
            for (ResponseOutputMessage.Content content : message.content()) {
                content.outputText().ifPresent(t -> text.append(t.text()));
                refused |= content.refusal().isPresent();
            }
        }
        if (refused) {
            return new GenerationOutcome(GenerationOutcome.Stop.REFUSED, "", in, out);
        }
        ResponseStatus status = response.status().orElse(null);
        if (ResponseStatus.INCOMPLETE.equals(status)) {
            boolean contentFilter = response.incompleteDetails()
                    .flatMap(d -> d.reason())
                    .map(r -> "content_filter".equals(r.asString()))
                    .orElse(false);
            return new GenerationOutcome(contentFilter ? GenerationOutcome.Stop.REFUSED : GenerationOutcome.Stop.TRUNCATED, "", in, out);
        }
        if (!ResponseStatus.COMPLETED.equals(status)) {
            throw new ProviderCallException(AiErrorCode.AI_PROVIDER_ERROR, 0);
        }
        return new GenerationOutcome(GenerationOutcome.Stop.COMPLETE, text.toString(), in, out);
    }

    @Override
    public void testConnection(String apiKey, String model) {
        OpenAIClient client = newClient(apiKey);
        try {
            client.models().retrieve(model);
        } catch (OpenAIException e) {
            throw translate(e);
        } finally {
            client.close();
        }
    }

    private static ProviderCallException translate(OpenAIException e) {
        int status = e instanceof OpenAIServiceException s ? s.statusCode() : 0;
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
        } else if (e instanceof OpenAIIoException) {
            code = AiErrorCode.AI_PROVIDER_CONNECTION;
        } else {
            code = AiErrorCode.AI_PROVIDER_ERROR;
        }
        return new ProviderCallException(code, status);
    }
}
