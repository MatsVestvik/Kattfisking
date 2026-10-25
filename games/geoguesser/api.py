"""
Norgeguesser (Geoguesser) - Backend API router
"""

from typing import Any, Dict, Optional, Tuple


class GeoguesserAPI:
    @staticmethod
    def handle_get(path: str, query: Dict[str, Any]) -> Optional[Tuple[int, Any]]:
        if path == "/api/geoguesser/status":
            return 200, {"ok": True, "game": "geoguesser"}
        return None

    @staticmethod
    def handle_post(path: str, body: Dict[str, Any]) -> Optional[Tuple[int, Any]]:
        return None
