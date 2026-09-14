from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('items', '0025_alter_itemdetails_student_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='itemdetails',
            name='verification_question_1',
            field=models.CharField(blank=True, default='', max_length=150),
        ),
        migrations.AddField(
            model_name='itemdetails',
            name='verification_question_2',
            field=models.CharField(blank=True, default='', max_length=150),
        ),
        migrations.AddField(
            model_name='itemdetails',
            name='verification_question_3',
            field=models.CharField(blank=True, default='', max_length=150),
        ),
        migrations.AddField(
            model_name='itemdetails',
            name='verification_question_4',
            field=models.CharField(blank=True, default='', max_length=150),
        ),
    ]
