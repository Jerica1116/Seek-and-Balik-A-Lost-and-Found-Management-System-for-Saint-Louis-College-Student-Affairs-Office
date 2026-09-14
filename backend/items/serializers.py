import json
import random

from rest_framework import serializers
# pyrefly: ignore [missing-import]
from .models import ItemDetails, ItemImage


# Generic decoy text used to pad multiple-choice verification options when
# there aren't enough other items in the same category to draw real decoy
# answers from. Kept vague on purpose so it never accidentally reads as a
# plausible real answer.
_GENERIC_DECOYS = [
    "None of the above",
    "I'm not sure",
    "Not applicable",
    "Can't recall",
]


def _is_staff_request(request):
    """
    True only for authenticated Admin/Moderator accounts (same rule as
    claim.permissions.IsStaffMember). Everyone else — anonymous claimants
    on the public landing page included — is treated as public.
    """
    if request is None:
        return False
    user = getattr(request, 'user', None)
    return bool(
        user
        and getattr(user, 'is_authenticated', False)
        and getattr(user, 'role', None) in ('admin', 'moderator')
    )


class ItemImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = ItemImage
        fields = ['id', 'image']

    def get_image(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url


class ItemSerializers(serializers.ModelSerializer):
    other_location = serializers.CharField(
        required=False,
        allow_blank=True,
        write_only=True
    )

    images = ItemImageSerializer(many=True, read_only=True)

    created_time = serializers.TimeField(
        format='%I:%M %p',
        input_formats=['%H:%M', '%I:%M %p']
    )

    class Meta:
        model = ItemDetails
        fields = '__all__'
        extra_kwargs = {
            'created_time': {'format': '%H:%M'}
        }

    def validate(self, attrs):
        location = attrs.get('location', '').strip()
        other_location = attrs.pop('other_location', '').strip()

        if location == 'Others':
            if not other_location:
                raise serializers.ValidationError({
                    'other_location': 'Please specify the location.'
                })

            attrs['location'] = other_location

        elif other_location:
            raise serializers.ValidationError({
                'other_location': 'Only fill this when location is Others.'
            })

        for n in range(1, 5):
            q_key = f'verification_question_{n}'
            a_key = f'verification_answer_{n}'

            q_val = attrs.get(q_key, getattr(self.instance, q_key, '') if self.instance else '')
            a_val = attrs.get(a_key, getattr(self.instance, a_key, '') if self.instance else '')
            q_val = (q_val or '').strip()
            a_val = (a_val or '').strip()

            if q_val and not a_val:
                raise serializers.ValidationError({
                    a_key: f'Please provide the correct answer for question {n}.'
                })

            if a_val and not q_val:
                raise serializers.ValidationError({
                    q_key: f'Please provide the question text for answer {n}.'
                })

        return attrs

    def _build_verification_options(self, instance, n):
        """
        LEGACY FALLBACK ONLY (used by _resolve_verification_options below
        when an item has no verification_options_N stored). Build a
        shuffled multiple-choice option list for verification question
        `n`: the real answer plus up to 3 decoys, pulled from other
        items' real answers in the same category, padded with generic
        filler if there aren't enough.
        """
        answer = (getattr(instance, f'verification_answer_{n}') or '').strip()
        if not answer:
            return None

        pool = list(
            ItemDetails.objects
            .filter(category=instance.category)
            .exclude(pk=instance.pk)
            .exclude(**{f'verification_answer_{n}': ''})
            .values_list(f'verification_answer_{n}', flat=True)
        )

        seen = {answer.strip().lower()}
        decoys = []
        random.shuffle(pool)
        for candidate in pool:
            candidate = (candidate or '').strip()
            key = candidate.lower()
            if not candidate or key in seen:
                continue
            seen.add(key)
            decoys.append(candidate)
            if len(decoys) == 3:
                break

        if len(decoys) < 3:
            filler = [d for d in _GENERIC_DECOYS if d.lower() not in seen]
            random.shuffle(filler)
            decoys.extend(filler[: 3 - len(decoys)])

        options = [answer] + decoys
        random.shuffle(options)
        return options

    def _resolve_verification_options(self, instance, n):
        """
        Returns the multiple-choice option list the Claim Modal dropdown
        should show for verification question `n`, or None if this
        question has no answer set (nothing to grade against / no
        dropdown should render).

        Prefers the full predefined list the admin/moderator actually
        configured (verification_options_N, stored as a JSON string —
        this already contains the correct answer as one of its entries).
        Falls back to the old sibling-answer decoy-building only for
        legacy items that predate this field / have nothing stored.
        """
        answer = (getattr(instance, f'verification_answer_{n}') or '').strip()
        if not answer:
            return None

        raw_stored = (getattr(instance, f'verification_options_{n}') or '').strip()
        if raw_stored:
            try:
                stored = json.loads(raw_stored)
            except (TypeError, ValueError):
                stored = None

            if isinstance(stored, list):
                seen = set()
                options = []
                for opt in stored:
                    if not isinstance(opt, str):
                        continue
                    opt = opt.strip()
                    key = opt.lower()
                    if opt and key not in seen:
                        seen.add(opt)
                        options.append(opt)

                if options:
                    if answer.lower() not in seen:
                        options.append(answer)
                    random.shuffle(options)
                    return options

        # Legacy fallback: no predefined list stored for this question —
        # build decoys from other items' answers in the same category.
        return self._build_verification_options(instance, n)

    def to_representation(self, instance):
        """Convert image field(s) to full URLs in responses"""
        data = super().to_representation(instance)

        if instance.image:
            request = self.context.get('request')
            data['image'] = request.build_absolute_uri(instance.image.url) if request else instance.image.url

        if not data.get('images') and instance.image:
            data['images'] = [{'id': None, 'image': data['image']}]

        # ------------------------------------------------------------
        # OWNERSHIP VERIFICATION ANSWERS — never leak these to the public.
        # ------------------------------------------------------------
        request = self.context.get('request')
        if not _is_staff_request(request):
            for n in range(1, 5):
                data.pop(f'verification_answer_{n}', None)
                options = self._resolve_verification_options(instance, n)
                if options is not None:
                    data[f'verification_options_{n}'] = options
                else:
                    data.pop(f'verification_options_{n}', None)

        return data