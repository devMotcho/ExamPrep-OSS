package com.exam_prep.api.entity;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class SessionSettingsConverter implements AttributeConverter<SessionSettings, String> {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String convertToDatabaseColumn(SessionSettings attribute) {
        if (attribute == null) {
            return "{}";
        }
        try {
            return objectMapper.writeValueAsString(attribute);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Error serializing SessionSettings", e);
        }
    }

    @Override
    public SessionSettings convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return new SessionSettings();
        }
        try {
            return objectMapper.readValue(dbData, SessionSettings.class);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Error deserializing SessionSettings", e);
        }
    }
}
