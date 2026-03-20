package com.codesentinel;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class CodeSentinelApplication {
    public static void main(String[] args) {
        SpringApplication.run(CodeSentinelApplication.class, args);
    }
}
