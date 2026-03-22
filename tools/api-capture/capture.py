"""
mitmproxy addon for capturing Uber Eats and Thuisbezorgd API traffic.

Usage:
    mitmproxy -s tools/api-capture/capture.py

Each intercepted response is written as a JSON file to:
    tools/api-capture/output/{platform}/{YYYYMMDDTHHMMSSF}.json

Entry schema:
    { method, url, request_headers, request_body,
      response_status, response_body }
"""
import json
import os
from datetime import datetime, timezone

from mitmproxy import http

PLATFORMS: dict[str, list[str]] = {
    "ubereats": ["ubereats.com"],
    # thuisbezorgd.nl is the consumer web frontend (Next.js SSR, mostly HTML)
    # cw-api.takeaway.com is the BFF that serves restaurant/menu/cart/order JSON
    # consumer.takeawaypay.com handles JetPay payment profile APIs
    "thuisbezorgd": ["thuisbezorgd.nl", "thuisbezorgd.com", "takeaway.com", "takeawaypay.com"],
}

_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")


def _platform_for_host(host: str) -> str | None:
    for platform, domains in PLATFORMS.items():
        if any(domain in host for domain in domains):
            return platform
    return None


def response(flow: http.HTTPFlow) -> None:
    platform = _platform_for_host(flow.request.host)
    if platform is None:
        return

    platform_dir = os.path.join(_OUTPUT_DIR, platform)
    os.makedirs(platform_dir, exist_ok=True)

    timestamp = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    filename = os.path.join(platform_dir, f"{timestamp}.json")

    try:
        request_body = flow.request.get_text(strict=False) or ""
    except Exception:
        request_body = "<binary>"

    try:
        response_body = (
            flow.response.get_text(strict=False) if flow.response else ""
        ) or ""
    except Exception:
        response_body = "<binary>"

    entry = {
        "method": flow.request.method,
        "url": flow.request.pretty_url,
        "request_headers": dict(flow.request.headers),
        "request_body": request_body,
        "response_status": flow.response.status_code if flow.response else None,
        "response_body": response_body,
    }

    with open(filename, "w", encoding="utf-8") as f:
        json.dump(entry, f, indent=2, ensure_ascii=False)

    print(f"[orderfood] captured {flow.request.method} {flow.request.pretty_url[:80]}")
