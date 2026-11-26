from django.core.management.base import BaseCommand

from shop.models import Category, Service

SIZES = ["Short", "A4", "Long"]
# name, reg print-only, rush print-only, reg with photo, rush with photo
ID_SETS = [
    ("Set A (2 2x2, 4 1x1)", 60, 75, 90, 105),
    ("Set B (3 2x2)", 60, 75, 90, 105),
    ("Set C (3 2x2, 6 1x1)", 70, 85, 95, 110),
    ("Set D (2 2x2, 4 1x1, 4 passport)", 85, 100, 115, 130),
    ("Set E (2 passport, 2 2x2)", 60, 75, 90, 105),
    ("Set E (5 passport)", 65, 80, 95, 105),
]


def rows():
    """(category, name, unit, price) taken from the JD Printing Press price list."""
    for label, prices in [("Xerox B&W", (6, 7, 8)), ("Xerox Partially Colored", (10, 10, 12)),
                          ("Xerox Fully Colored", (14, 14, 17)), ("ID Back-to-back B&W", (5, 6, 7)),
                          ("ID Back-to-back Colored", (8, 9, 10))]:
        for size, p in zip(SIZES, prices):
            yield "Photocopy", f"{label} - {size}", "page", p
    yield "Photocopy", "Additional ID (back-to-back)", "ID", 3

    for label, prices in [("Print B&W", (6, 7, 8)), ("Print Partially Colored", (11, 11, 13)),
                          ("Print Fully Colored", (15, 15, 18))]:
        for size, p in zip(SIZES, prices):
            yield "Printing", f"{label} - {size}", "page", p

    for label, p in [("1-5 pages", 12), ("6-20 pages", 9), ("21-50 pages", 7), ("51+ pages", 5)]:
        yield "Scanning", f"Scanning {label}", "page", p

    for size in ["A4", "5R", "4R", "3R", "2R"]:
        yield "Photo Print", f"Photo Print {size}", "photo", 0   # price not on the flyer yet

    for name, r, rush, rp, rushp in ID_SETS:
        yield "ID Package", f"{name} - Print only - Reg", "set", r
        yield "ID Package", f"{name} - Print only - Rush", "set", rush
        yield "ID Package", f"{name} - With photo - Reg", "set", rp
        yield "ID Package", f"{name} - With photo - Rush", "set", rushp

    for n in ["Laminating"]:
        yield "Laminating", n, "piece", 0
    for n in ["Ref Magnet", "Coloring Book", "Party Hat", "Thank You Tag", "Chip Bag", "Loot Bag/Cable Box",
              "Personalized Mug", "Thank You Card", "Customized Calendar", "Raffle Ticket",
              "Acrylic Keychain", "Acrylic Plaque", "Key Holder"]:
        yield "Souvenirs & Giveaways", n, "piece", 0
    for n in ["Invitations", "Tarpaulin", "Tarpapel", "Typing Job", "Resume", "Sticker Print",
              "Calling Card", "Sintra Board", "PVC ID/Nametag", "Sublimation/DTF"]:
        yield "Other Services", n, "piece", 0


class Command(BaseCommand):
    help = "Load categories and services from the price list. Safe to run again; never overwrites your edits."

    def handle(self, *args, **opts):
        made = 0
        for cat, name, unit, price in rows():
            c, _ = Category.objects.get_or_create(name=cat)
            _, new = Service.objects.get_or_create(name=name, defaults={"category": c, "unit": unit, "price": price})
            made += new
        self.stdout.write(self.style.SUCCESS(f"Done. {made} new services added."))
