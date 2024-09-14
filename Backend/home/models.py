from django.db import models

# Create your models here.
class Note(models.Model):
    title = models.CharField(max_length=100 , default='None')
    body = models.TextField(default='None')
    
    def __str__(self):
        return self.title
