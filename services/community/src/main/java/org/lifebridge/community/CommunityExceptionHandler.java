package org.lifebridge.community;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import tools.jackson.databind.exc.UnrecognizedPropertyException;

@RestControllerAdvice
public final class CommunityExceptionHandler {
  @ExceptionHandler(CommunityFailure.class)
  ResponseEntity<Map<String, Object>> known(
      CommunityFailure failure, HttpServletRequest request) {
    return failure(
        failure.status(),
        failure.code(),
        failure.messageKey(),
        failure.retryable(),
        request);
  }

  @ExceptionHandler({
    HttpMessageNotReadableException.class,
    UnrecognizedPropertyException.class,
    IllegalArgumentException.class,
    MissingRequestHeaderException.class
  })
  ResponseEntity<Map<String, Object>> validation(
      Exception ignored, HttpServletRequest request) {
    String code =
        request.getRequestURI().contains("/directory")
            ? "DIRECTORY_VALIDATION_FAILED"
            : "COMMUNITY_REQUEST_VALIDATION_FAILED";
    return failure(
        HttpStatus.BAD_REQUEST,
        code,
        code.equals("DIRECTORY_VALIDATION_FAILED")
            ? "community.directory.validation"
            : "community.request.validation",
        false,
        request);
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String, Object>> unexpected(
      Exception ignored, HttpServletRequest request) {
    String code =
        request.getRequestURI().contains("/directory")
            ? "DIRECTORY_SEARCH_UNAVAILABLE"
            : "COMMUNITY_SERVICE_UNAVAILABLE";
    return failure(
        HttpStatus.SERVICE_UNAVAILABLE,
        code,
        code.equals("DIRECTORY_SEARCH_UNAVAILABLE")
            ? "community.directory.search_unavailable"
            : "community.unavailable",
        true,
        request);
  }

  private ResponseEntity<Map<String, Object>> failure(
      HttpStatus status,
      String code,
      String messageKey,
      boolean retryable,
      HttpServletRequest request) {
    return ResponseEntity.status(status)
        .header("cache-control", "no-store")
        .body(
            Map.of(
                "error",
                Map.of(
                    "code", code,
                    "messageKey", messageKey,
                    "retryable", retryable,
                    "correlationId",
                        InternalTokenFilter.safeCorrelation(
                            request.getHeader("x-correlation-id")))));
  }
}
