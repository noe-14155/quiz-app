from app.questions import service as questions_service


def draw_question(themes, difficulte_max, exclude_ids=None):
    results = questions_service.fetch_questions(
        themes=themes, difficulte_max=difficulte_max, exclude_ids=exclude_ids, limit=1, hide_answer=False, allow_repeat=False,
    )
    return results[0] if results else None
