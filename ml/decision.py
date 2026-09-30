"""
The action-oriented layer the pitch deck calls out as the actual differentiator:
DRILL / SURVEY / RELOCATE / AVOID, plus explicit "Insufficient Data" handling.
Nothing here is a model output — it's a rule layered on top of the three model
predictions plus a confidence signal derived from local data density.

Confidence is proxied by existing_wells_2km: locations far from any well in the
576-well reference set are extrapolating further from what the model has seen and
get flagged as low-confidence / insufficient data instead of a false-precise number.
"""

MIN_WELLS_FOR_CONFIDENCE = 2   # existing_wells_2km below this => low confidence
SUCCESS_DRILL_THRESHOLD = 0.65
SUCCESS_AVOID_THRESHOLD = 0.35


def decide(success_probability, existing_wells_2km, block_category):
    if existing_wells_2km < MIN_WELLS_FOR_CONFIDENCE:
        return {
            "decision": "INSUFFICIENT_DATA",
            "confidence": "low",
            "reason": f"Only {existing_wells_2km} reference well(s) within 2km — prediction is extrapolating beyond training data.",
        }

    confidence = "high" if existing_wells_2km >= 5 else "medium"

    if block_category == "Over Exploited" and success_probability < SUCCESS_DRILL_THRESHOLD:
        return {
            "decision": "AVOID",
            "confidence": confidence,
            "reason": "Block is groundwater Over-Exploited (INGRES) and predicted success is not high enough to justify new extraction.",
        }

    if success_probability >= SUCCESS_DRILL_THRESHOLD:
        return {
            "decision": "DRILL",
            "confidence": confidence,
            "reason": f"Predicted success probability {success_probability:.2f} is above the drill threshold.",
        }
    elif success_probability <= SUCCESS_AVOID_THRESHOLD:
        return {
            "decision": "AVOID",
            "confidence": confidence,
            "reason": f"Predicted success probability {success_probability:.2f} is low.",
        }
    else:
        return {
            "decision": "SURVEY",
            "confidence": confidence,
            "reason": f"Predicted success probability {success_probability:.2f} is borderline — a paid geophysical survey is cheaper than a blind drill here.",
        }
