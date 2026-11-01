package com.exam_prep.api.aigen;

import com.exam_prep.api.exception.AppException;
import lombok.Getter;
import org.springframework.http.HttpStatus;

/** AppException carrying a stable code the frontend maps to a translated message. */
@Getter
public class AiGenException extends AppException {
    private final AiErrorCode code;

    public AiGenException(AiErrorCode code, HttpStatus status) {
        super(code.message(), status);
        this.code = code;
    }

    public AiGenException(AiErrorCode code, String message, HttpStatus status) {
        super(message, status);
        this.code = code;
    }
}
