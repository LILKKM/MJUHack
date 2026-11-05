package com.example.hack;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** 끝의 슬래시와 공백은 잘못 입력해도 동작해야 한다. */
@SpringBootTest(properties = "app.cors.allowed-origins=https://front.example.com/ , https://second.example.com")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CorsIntegrationTests {

    @Autowired
    MockMvc mvc;

    @Test
    void allowedOriginPassesPreflightAndPost() throws Exception {
        mvc.perform(options("/api/chat/sessions")
                        .header("Origin", "https://front.example.com")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://front.example.com"));
        mvc.perform(post("/api/chat/sessions").header("Origin", "https://second.example.com")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://second.example.com"));
    }

    @Test
    void otherOriginIsRejected() throws Exception {
        mvc.perform(options("/api/chat/sessions")
                        .header("Origin", "https://evil.example.com")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }
}
