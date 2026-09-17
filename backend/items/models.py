from django.db import models
import uuid

MAX_IMAGES_PER_ITEM = 3  # used by views.py — kept here as the single source of truth


class ItemDetails(models.Model):

    LOCATIONS = [
        ("All", "All"),
        ("Grandstand", "Grandstand"),
    ("(V) Verbist Building", "(V) Verbist Building"),
    ("Transfiguration of the Lord Chapel", "Transfiguration of the Lord Chapel"),
    ("Fr. Alfred Spincemaille, CICM (Administrative Building)", "Fr. Alfred Spincemaille, CICM (Administrative Building)"),
    ("Gerard De Boeck Mission Library", "Gerard De Boeck Mission Library"),
    ("Fr. Burgos Gymnasium", "Fr. Burgos Gymnasium"),
    ("B ICT Center", "B ICT Center"),
    ("(C) New Building", "(C) New Building"),
    ("New Elementary Building", "New Elementary Building"),
    ("SC Canteen", "SC Canteen"),
    ("(E) Bishop Wenceslao Padilla, CICM (Old Elementary Building)", "(E) Bishop Wenceslao Padilla, CICM (Old Elementary Building)"),
    ("Conrado Dela Cruz Sports Center", "Conrado Dela Cruz Sports Center"),
    ("Fr. Roger Bruno Eduard Tolle, CICM (Senior High School Department Building)", "Fr. Roger Bruno Eduard Tolle, CICM (Senior High School Department Building)"),
    ("Rev. Fr. Clement Daelman, CICM (HM Laboratory Building)", "Rev. Fr. Clement Daelman, CICM (HM Laboratory Building)"),
    ]

    CATEGORIES = [
    ("All", "All"),
    ("Accessories", "Accessories"),
    ("ID", "ID"),
    ("Academic Materials", "Academic Materials"),
    ("Bags & Wallets", "Bags & Wallets"),
    ("Clothing", "Clothing"),
    ("Electronic", "Electronic"),
    ("Keys", "Keys"),
    ]

    ITEM_TYPE = [
        ("Lost", "Lost"),
        ("Surrendered", "Surrendered"),
    ]

    STATUS_OPTION = [
        ("Pending", "Pending"),
        ("Approved", "Approved"),
        ("Claimed", "Claimed"),
        ("Returned", "Returned"),
        ("Archived", "Archived"),
        ('Declined', 'Declined'),
    ]

    title = models.CharField(max_length=30)
    description = models.TextField(max_length=100, default='')

    # Reason staff gave when declining a report (status == 'Declined').
    # Kept even if the status later changes, so the history isn't lost —
    # the frontend only re-sends an empty string here when a report is
    # actively moved OUT of 'Declined'.
    declined_remarks = models.TextField(blank=True, default='')

    # ------------------------------------------------------------------
    # OWNERSHIP VERIFICATION QUESTIONS + ANSWERS (max 4 pairs)
    #
    # Written by admin/moderator when logging the found item. The
    # QUESTION text is shown to the claimant in the public Claim Modal
    # (replacing the generic per-category question set for this specific
    # item), rendered as a multiple-choice dropdown built from the real
    # ANSWER plus a few decoys. The ANSWER itself is never sent to public
    # (non-staff) API responses — see ItemSerializers.to_representation —
    # it is only used server-side to build the multiple-choice options and
    # to grade the claimant's selection via the verify-answers endpoint.
    # All optional — if a pair is left blank, the Claim Modal falls back
    # to the generic per-category (free-text) questions.
    # ------------------------------------------------------------------
    verification_question_1 = models.CharField(max_length=150, blank=True, default='')
    verification_answer_1 = models.CharField(max_length=150, blank=True, default='')
    verification_question_2 = models.CharField(max_length=150, blank=True, default='')
    verification_answer_2 = models.CharField(max_length=150, blank=True, default='')
    verification_question_3 = models.CharField(max_length=150, blank=True, default='')
    verification_answer_3 = models.CharField(max_length=150, blank=True, default='')
    verification_question_4 = models.CharField(max_length=150, blank=True, default='')
    verification_answer_4 = models.CharField(max_length=150, blank=True, default='')

    # Full predefined answer-choice list for each verification question,
    # stored as a JSON-encoded string (e.g. '["Nike","Adidas","Penshoppe"]').
    # Populated by FoundItems.jsx's ItemModal (getPresetAnswerOptions) when
    # the question maps to a Question Bank preset with options, or to the
    # generic color/brand fallback list. Empty string means this question
    # has no predefined choices (free text). This is what the Claim Modal
    # dropdown is actually built from — see ItemSerializers.to_representation.
    verification_options_1 = models.TextField(blank=True, default='')
    verification_options_2 = models.TextField(blank=True, default='')
    verification_options_3 = models.TextField(blank=True, default='')
    verification_options_4 = models.TextField(blank=True, default='')

    category = models.CharField(choices=CATEGORIES, default="All", max_length=30)
    location = models.CharField(default="All", max_length=254)
    created_date = models.DateField()
    created_time = models.TimeField()
    image = models.ImageField(upload_to='items_photos/', null=True, blank=True)
    status = models.CharField(choices=STATUS_OPTION, max_length=30, default="Pending")
    type = models.CharField(choices=ITEM_TYPE, max_length=30, default="Lost")
    poster_name = models.CharField(max_length=30, default='')

    student_id = models.CharField(max_length=30, null=True, blank=True)

    email = models.EmailField(max_length=254, default='')

    time_stamp = models.DateTimeField(auto_now_add=True)

    # ------------------------------------------------------------------
    # CLAIM TRACKING
    #
    # Set by FoundItems.jsx's handleClaimItem() at the moment staff mark
    # an item as claimed (status -> 'Claimed'), so the Found Items table
    # can show "Date Claimed" alongside "Date Found" (created_date). Both
    # stay null until then. claimed_time is a plain CharField (not
    # TimeField) to match how meeting_time is stored on the Claim model —
    # the frontend sends a simple "HH:MM" string
    # (now.toTimeString().slice(0, 5)), and TimeField would need the same
    # kind of extra input/output format handling created_time already has
    # in ItemSerializers.
    #
    # Since ItemSerializers.Meta.fields = '__all__', no serializer change
    # is needed — these are picked up automatically once added here and
    # migrated.
    # ------------------------------------------------------------------
    claimed_date = models.DateField(null=True, blank=True)
    claimed_time = models.CharField(max_length=20, null=True, blank=True)

    #GAMIFICATION
    surrender_points_awarded = models.BooleanField(default=False)
    claimed_bonus_awarded = models.BooleanField(default=False)

    # 🔥 TICKET SYSTEM
    ticket_code = models.CharField(max_length=20, unique=True, blank=True, null=True)

    def save(self, *args, **kwargs):
        is_new = self.pk is None

        super().save(*args, **kwargs)

        if is_new and not self.ticket_code:
            self.ticket_code = f"TKT-{self.id}-{uuid.uuid4().hex[:4].upper()}"
            super().save(update_fields=["ticket_code"])

    def __str__(self):
        return f"{self.title} {self.type} {self.status}"


class ItemImage(models.Model):
    """
    A single photo belonging to an ItemDetails entry. Items can have up to
    MAX_IMAGES_PER_ITEM (3) photos — enforced on the frontend by
    PhotoUpload.jsx AND on the backend in views.py (create/update) — so
    photos live in their own table with a FK back to the item rather than
    as a single field on ItemDetails. The legacy `ItemDetails.image` field
    is kept as-is for backward compatibility with records created before
    this model existed, but new uploads are stored here.
    """
    item = models.ForeignKey(ItemDetails, related_name='images', on_delete=models.CASCADE)
    image = models.ImageField(upload_to='items_photos/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Photo for {self.item.title} (#{self.item_id})"