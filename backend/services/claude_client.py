import openai

from backend.config import get_settings


async def call_llm(system_prompt: str, user_message: str, max_tokens: int = 4096) -> str:
    """Call OpenAI chat completions API with a system prompt and user message, return text response."""
    settings = get_settings()
    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)

    response = await client.chat.completions.create(
        model=settings.openai_chat_model,
        max_completion_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=0.2,
    )

    return response.choices[0].message.content
