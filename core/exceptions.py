from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, ValidationError


def error_response(code: str, message: str, status_code: int = 400, details: list = None):
    return Response(
        {
            "error": {
                "code": code,
                "message": message,
                "details": details if details is not None else [],
            }
        },
        status=status_code,
    )


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        details = []
        code = "VALIDATION_ERROR"

        if isinstance(exc, NotFound) or response.status_code == 404:
            code = "NOT_FOUND"
            message = "The requested resource was not found."
        elif response.status_code == 400:
            code = "VALIDATION_ERROR"
            if isinstance(response.data, dict):
                parts = []
                for k, v in response.data.items():
                    msg = " ".join(v) if isinstance(v, list) else str(v)
                    parts.append(f"{k}: {msg}")
                    details.append({"field": k, "issue": msg})
                message = "; ".join(parts) if parts else "Invalid input."
            elif isinstance(response.data, list):
                message = "; ".join(str(x) for x in response.data)
                details = response.data
            else:
                message = str(response.data)
        elif response.status_code == 409:
            code = getattr(exc, "code", "CONFLICT")
            message = str(exc.detail) if hasattr(exc, "detail") else "Resource conflict."
        else:
            message = str(exc)

        response.data = {
            "error": {
                "code": code,
                "message": message,
                "details": details,
            }
        }
    return response
