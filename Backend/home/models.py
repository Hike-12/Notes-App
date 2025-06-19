from django.db import models
from django.contrib.auth.models import User

class Note(models.Model):
    title = models.CharField(max_length=100, default='None')
    body = models.TextField(default='None')
    last_modified = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.title

class Collaborator(models.Model):
    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name='collaborators')
    user_identifier = models.CharField(max_length=100)  # Can be user ID or session ID
    user_name = models.CharField(max_length=100, default='Anonymous')
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    color = models.CharField(max_length=7, default='#3B3B1A')  # Hex color for user cursor
    
    class Meta:
        unique_together = ('note', 'user_identifier')
    
    def __str__(self):
        return f"{self.user_name} - {self.note.title}"