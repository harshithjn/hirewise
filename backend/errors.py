from typing import Any


class AppError(Exception):
    def __init__(self, message: str, code: str = "app_error", status: int = 400):
        super().__init__(message)
        self.message, self.code, self.status = message, code, status


def ok(data: Any = None) -> dict:
    return {"data": data, "error": None}


def fail(code: str, message: str) -> dict:
    return {"data": None, "error": {"code": code, "message": message}}
