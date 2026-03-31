from datetime import date, datetime


def format_date(value):
    if not value:
        return None
    return value.isoformat()


def format_datetime(value):
    if not value:
        return None
    return value.isoformat()


def last_active_label(value):
    if not value:
        return "Never"
    now = datetime.utcnow()
    delta = now - value
    if delta.days >= 1:
        return f"{delta.days} day{'s' if delta.days != 1 else ''} ago"
    hours = delta.seconds // 3600
    if hours >= 1:
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    minutes = max(delta.seconds // 60, 1)
    if minutes <= 2:
        return "Just now"
    return f"{minutes} minutes ago"


def format_pretty_date(value):
    if not value:
        return None
    if isinstance(value, datetime):
        value = value.date()
    if isinstance(value, date):
        return value.strftime("%B %#d, %Y")
    return str(value)
