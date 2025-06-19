from django.db import models
from django.contrib.auth.models import User

class Note(models.Model):
    title = models.CharField(max_length=100, default='Untitled Note')
    body = models.TextField(default='')
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_notes')
    created_at = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)
    is_public = models.BooleanField(default=False)  # For public sharing
    
    def __str__(self):
        return f"{self.title} - {self.owner.username}"

class NoteShare(models.Model):
    PERMISSION_CHOICES = [
        ('view', 'View Only'),
        ('edit', 'Can Edit'),
    ]
    
    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name='shares')
    shared_with = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shared_notes')
    permission = models.CharField(max_length=10, choices=PERMISSION_CHOICES, default='view')
    shared_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shares_given')
    shared_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('note', 'shared_with')
    
    def __str__(self):
        return f"{self.note.title} shared with {self.shared_with.username} ({self.permission})"

class Collaborator(models.Model):
    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name='collaborators')
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    user_identifier = models.CharField(max_length=100)  # For anonymous users
    user_name = models.CharField(max_length=100, default='Anonymous')
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    color = models.CharField(max_length=7, default='#3B3B1A')
    
    class Meta:
        unique_together = ('note', 'user_identifier')
    
    def __str__(self):
        return f"{self.user_name} - {self.note.title}"