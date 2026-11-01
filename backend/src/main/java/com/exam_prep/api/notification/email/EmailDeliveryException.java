package com.exam_prep.api.notification.email;

class EmailDeliveryException extends RuntimeException {

    EmailDeliveryException(String message) {
        super(message);
    }

    EmailDeliveryException(String message, Throwable cause) {
        super(message, cause);
    }

}
