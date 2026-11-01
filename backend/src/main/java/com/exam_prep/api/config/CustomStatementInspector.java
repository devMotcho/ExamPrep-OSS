package com.exam_prep.api.config;

import org.hibernate.resource.jdbc.spi.StatementInspector;
import java.util.concurrent.atomic.AtomicLong;

public class CustomStatementInspector implements StatementInspector {

    public static final AtomicLong queryCounter = new AtomicLong(0);

    @Override
    public String inspect(String sql) {
        queryCounter.incrementAndGet();
        return sql;
    }
}
