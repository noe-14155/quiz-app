from app.questions import service as questions_service


def draw_question(theme: str, bid: int, exclude_ids=None):
    """La mise (1 à 10) détermine la difficulté de la question posée (1 à 5)."""
    difficulty = min(5, max(1, -(-bid // 2)))  # équivalent de ceil(bid / 2)
    results = questions_service.fetch_questions(
        themes=[theme], difficulte=difficulty, exclude_ids=exclude_ids, limit=1, hide_answer=False, allow_repeat=False,
    )
    if not results:
        results = questions_service.fetch_questions(
            themes=[theme], exclude_ids=exclude_ids, limit=1, hide_answer=False, allow_repeat=False,
        )
    return results[0] if results else None
