package org.lifebridge.community;

import org.springframework.http.HttpStatus;

public final class CommunityFailure extends RuntimeException {
  private final HttpStatus status;
  private final String code;
  private final String messageKey;
  private final boolean retryable;

  public CommunityFailure(
      HttpStatus status, String code, String messageKey, boolean retryable) {
    super(code);
    this.status = status;
    this.code = code;
    this.messageKey = messageKey;
    this.retryable = retryable;
  }

  public HttpStatus status() {
    return status;
  }

  public String code() {
    return code;
  }

  public String messageKey() {
    return messageKey;
  }

  public boolean retryable() {
    return retryable;
  }
}
