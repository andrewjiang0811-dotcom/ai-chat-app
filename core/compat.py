"""
Python compatibility module for cross-version support (Python 3.10 and earlier).
Provides polyfills such as enum.StrEnum so packages like gemini_webapi can import without errors.
"""
import enum

if not hasattr(enum, "StrEnum"):
    try:
        from strenum import StrEnum
        enum.StrEnum = StrEnum
    except ImportError:
        class StrEnum(str, enum.Enum):
            def __str__(self):
                return str(self.value)
        enum.StrEnum = StrEnum
