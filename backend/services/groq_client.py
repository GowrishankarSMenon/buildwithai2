"""
groq_client.py — Groq LLaMA Client Service
Uses LangChain's ChatOpenAI pointed at Groq's OpenAI-compatible endpoint.
This gives us access to fast LLaMA inference for agent reasoning.
"""

import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

# Load .env from backend directory
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def get_llm() -> ChatOpenAI:
    """
    Factory function that returns a ChatOpenAI instance configured for Groq.
    Uses llama-3.3-70b-versatile model for high-quality reasoning.
    """
    api_key = os.getenv("GROQ_API_KEY", "")
    return ChatOpenAI(
        model="llama-3.3-70b-versatile",
        openai_api_key=api_key,
        openai_api_base="https://api.groq.com/openai/v1",
        temperature=0.3,  # Low temp for consistent, deterministic outputs
        max_tokens=1024,
    )
