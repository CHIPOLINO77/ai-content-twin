import re
from collections import Counter

STOP = set("и в во не что он она оно они я мы вы ты на по за из от до с со а но или как это для у к о".split())

def analyze_text(title: str, transcript: str) -> dict:
    words = re.findall(r"[А-Za-zА-Яа-яЁё0-9]+", transcript.lower())
    useful = [w for w in words if w not in STOP and len(w) > 2]
    sentences = [s.strip() for s in re.split(r"[.!?]+", transcript) if s.strip()]
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", transcript) if p.strip()]
    freq = Counter(useful)
    repeated = [{"word": w, "count": n} for w, n in freq.most_common(20) if n >= 3]

    hooks = []
    for s in sentences[:12]:
        if "?" in s or re.search(r"\b(почему|как|никогда|секрет|ошибка|правда|главное)\b", s, re.I):
            hooks.append(s[:300])

    return {
        "title": title,
        "word_count": len(words),
        "sentence_count": len(sentences),
        "estimated_minutes": round(len(words) / 130, 1),
        "paragraph_count": len(paragraphs),
        "recurring_terms": repeated,
        "hook_candidates": hooks[:10],
        "avg_sentence_words": round(len(words) / max(1, len(sentences)), 1),
    }
