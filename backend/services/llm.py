"""Single entry point for LLM calls: retries, JSON validation + one repair pass, PII redaction, logging.
Supports Anthropic (ANTHROPIC_API_KEY) or Groq (GROQ_API_KEY)."""
import json
import logging
import re
import time

import anthropic
from pydantic import BaseModel, ValidationError

import config
from errors import AppError

log = logging.getLogger("hirewise.llm")

TIMEOUT_S = 60
MAX_RETRIES = 2
MAX_RATE_LIMIT_RETRIES = 4
GROQ_MAX_TOKENS = 3500  # Groq counts max_tokens against its tokens-per-minute budget
_client = None
_groq_client = None

_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_PHONE = re.compile(r"(?<![\w.])\+?\(?\d[\d\s().\-]{7,}\d(?!\w)")
_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.S | re.I)


def _provider() -> str:
    return "anthropic" if config.ANTHROPIC_API_KEY or not config.GROQ_API_KEY else "groq"


def get_client():
    global _client
    if not config.ANTHROPIC_API_KEY:
        raise AppError("The AI service is not configured. Set GROQ_API_KEY or ANTHROPIC_API_KEY in backend/.env.",
                       code="llm_not_configured", status=503)
    if _client is None:
        _client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, timeout=TIMEOUT_S, max_retries=0)
    return _client


def get_groq_client():
    global _groq_client
    if _groq_client is None:
        import groq

        _groq_client = groq.Groq(api_key=config.GROQ_API_KEY, timeout=TIMEOUT_S, max_retries=0)
    return _groq_client


def _sleep(seconds: float) -> None:
    time.sleep(seconds)


class Redactor:
    """Swap emails/phones for tokens before text leaves the process; swap back afterwards."""

    def __init__(self) -> None:
        self.mapping: dict[str, str] = {}
        self._reverse: dict[str, str] = {}

    def _token(self, kind: str, value: str) -> str:
        if value in self._reverse:
            return self._reverse[value]
        tok = f"<<{kind}_{sum(t.startswith(f'<<{kind}_') for t in self.mapping) + 1}>>"
        self.mapping[tok] = value
        self._reverse[value] = tok
        return tok

    def redact(self, text: str) -> str:
        text = _EMAIL.sub(lambda m: self._token("EMAIL", m.group(0)), text)

        def phone(m: re.Match) -> str:
            raw = m.group(0)
            groups = re.findall(r"\d+", raw)
            if not 9 <= sum(map(len, groups)) <= 15:
                return raw
            if all(len(g) == 4 and g[:2] in ("19", "20") for g in groups):
                return raw
            return self._token("PHONE", raw)

        return _PHONE.sub(phone, text)

    def restore(self, text: str) -> str:
        for tok, val in self.mapping.items():
            text = text.replace(tok, val)
        return text


def _rate_limit_wait(exc: Exception, attempt: int) -> float:
    m = re.search(r"try again in ([\d.]+)s", str(exc))
    return min(float(m.group(1)) + 0.5, 20.0) if m else float(2**attempt)


def _is_retryable(exc: Exception) -> bool:
    if type(exc).__name__ in ("APIConnectionError", "APITimeoutError", "RateLimitError"):
        return True
    return isinstance(getattr(exc, "status_code", None), int) and exc.status_code >= 500


def _call_provider(system: str, messages: list[dict], temperature: float, max_tokens: int):
    if _provider() == "groq":
        resp = get_groq_client().chat.completions.create(
            model=config.LLM_MODEL, messages=[{"role": "system", "content": system}, *messages],
            temperature=temperature, max_tokens=min(max_tokens, GROQ_MAX_TOKENS))
        u = resp.usage
        return resp.choices[0].message.content or "", (u.prompt_tokens, u.completion_tokens)
    resp = get_client().messages.create(model=config.LLM_MODEL, system=system, messages=messages,
                                        temperature=temperature, max_tokens=max_tokens)
    text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
    return text, (resp.usage.input_tokens, resp.usage.output_tokens)


def _complete(system: str, messages: list[dict], temperature: float, max_tokens: int) -> str:
    last = None
    attempt = 0
    while True:
        start = time.perf_counter()
        try:
            text, (tin, tout) = _call_provider(system, messages, temperature, max_tokens)
        except AppError:
            raise
        except Exception as exc:  # noqa: BLE001
            last = exc
            limited = type(exc).__name__ == "RateLimitError"
            budget = MAX_RATE_LIMIT_RETRIES if limited else MAX_RETRIES
            if not _is_retryable(exc) or attempt >= budget:
                break
            log.warning("LLM call failed (attempt %d/%d): %s", attempt + 1, budget + 1, type(exc).__name__)
            _sleep(_rate_limit_wait(exc, attempt) if limited else 2**attempt)
            attempt += 1
            continue
        log.info("llm ok model=%s latency_ms=%d in=%s out=%s", config.LLM_MODEL, (time.perf_counter() - start) * 1000, tin, tout)
        return text
    log.error("LLM call failed permanently: %r", last)
    if getattr(last, "status_code", None) in (401, 403):
        raise AppError("The AI service rejected the API key.", code="llm_auth", status=502)
    raise AppError("The AI service is unavailable right now. Please try again.", code="llm_unavailable", status=502)


def _extract_json(text: str):
    m = _FENCE.search(text)
    if m:
        text = m.group(1)
    text = text.strip()
    if not text.startswith(("{", "[")):
        lo, hi = text.find("{"), text.rfind("}")
        if lo != -1 and hi > lo:
            text = text[lo : hi + 1]
    return json.loads(text)


def call_llm(system: str, user: str, json_schema: type[BaseModel] | None = None, temperature: float = 0, max_tokens: int = 4096):
    """Plain text when json_schema is None; otherwise a validated instance of the model."""
    red = Redactor()
    system, user = red.redact(system), red.redact(user)
    if json_schema is not None:
        system += ("\n\nRespond with a single JSON object only: no prose, no markdown fences. "
                   "It must conform to this JSON Schema:\n" + json.dumps(json_schema.model_json_schema()))
    messages = [{"role": "user", "content": user}]
    raw = red.restore(_complete(system, messages, temperature, max_tokens))
    if json_schema is None:
        return raw.strip()
    try:
        return json_schema.model_validate(_extract_json(raw))
    except (ValueError, ValidationError) as first:
        log.warning("LLM output failed validation, one repair attempt: %s", str(first)[:300])
        messages += [{"role": "assistant", "content": red.redact(raw) or "(empty)"},
                     {"role": "user", "content": f"That response was invalid: {str(first)[:1500]}\nReturn the corrected JSON object only."}]
        raw2 = red.restore(_complete(system, messages, temperature, max_tokens))
        try:
            return json_schema.model_validate(_extract_json(raw2))
        except (ValueError, ValidationError) as second:
            log.error("Still invalid after repair: %s", str(second)[:300])
            raise AppError("The AI returned a response in an unexpected format. Please try again.",
                           code="llm_invalid_output", status=502) from second
