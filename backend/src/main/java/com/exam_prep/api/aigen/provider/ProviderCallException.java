package com.exam_prep.api.aigen.provider;

import com.exam_prep.api.aigen.AiErrorCode;
import lombok.Getter;

/** Sanitised provider failure: only a code, never the upstream message or request data. */
@Getter
public class ProviderCallException extends RuntimeException {
    private final AiErrorCode code;
    private final int httpStatus;

    public ProviderCallException(AiErrorCode code, int httpStatus) {
        super(code.name(), null, false, false);
        this.code = code;
        this.httpStatus = httpStatus;
    }
}
