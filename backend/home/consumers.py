import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Note, Collaborator
import random

class NoteConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.note_id = self.scope['url_route']['kwargs']['note_id']
        self.note_group_name = f'note_{self.note_id}'
        
        # Join note group
        await self.channel_layer.group_add(
            self.note_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Add user as collaborator
        user_data = await self.add_collaborator()
        
        # Send current collaborators list to all users
        collaborators = await self.get_collaborators()
        await self.channel_layer.group_send(
            self.note_group_name,
            {
                'type': 'collaborators_update',
                'collaborators': collaborators
            }
        )

    async def disconnect(self, close_code):
        # Remove user as collaborator
        await self.remove_collaborator()
        
        # Send updated collaborators list
        collaborators = await self.get_collaborators()
        await self.channel_layer.group_send(
            self.note_group_name,
            {
                'type': 'collaborators_update',
                'collaborators': collaborators
            }
        )
        
        # Leave note group
        await self.channel_layer.group_discard(
            self.note_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data['type']
        
        if message_type == 'content_change':
            # Broadcast content change to all users in the note
            await self.channel_layer.group_send(
                self.note_group_name,
                {
                    'type': 'content_update',
                    'content': data['content'],
                    'user_id': data.get('user_id'),
                    'sender_channel': self.channel_name
                }
            )
        elif message_type == 'cursor_position':
            # Broadcast cursor position
            await self.channel_layer.group_send(
                self.note_group_name,
                {
                    'type': 'cursor_update',
                    'position': data['position'],
                    'user_id': data.get('user_id'),
                    'user_name': data.get('user_name'),
                    'color': data.get('color'),
                    'sender_channel': self.channel_name
                }
            )

    async def content_update(self, event):
        # Don't send back to sender
        if event['sender_channel'] != self.channel_name:
            await self.send(text_data=json.dumps({
                'type': 'content_change',
                'content': event['content'],
                'user_id': event['user_id']
            }))

    async def cursor_update(self, event):
        # Don't send back to sender
        if event['sender_channel'] != self.channel_name:
            await self.send(text_data=json.dumps({
                'type': 'cursor_position',
                'position': event['position'],
                'user_id': event['user_id'],
                'user_name': event['user_name'],
                'color': event['color']
            }))

    async def collaborators_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'collaborators_update',
            'collaborators': event['collaborators']
        }))

    async def note_saved(self, event):
        await self.send(text_data=json.dumps({
            'type': 'note_saved',
            'message': event['message']
        }))

    async def note_deleted(self, event):
        await self.send(text_data=json.dumps({
            'type': 'note_deleted',
            'message': event['message']
        }))

    @database_sync_to_async
    def add_collaborator(self):
        session_id = self.scope.get('session', {}).get('session_key', 'anonymous')
        user_id = f"user_{session_id}_{self.channel_name[-8:]}"
        
        # Generate random color for user
        colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
        color = random.choice(colors)
        
        collaborator, created = Collaborator.objects.get_or_create(
            note_id=self.note_id,
            user_identifier=user_id,
            defaults={
                'is_active': True,
                'user_name': f'User{user_id[-4:]}',
                'color': color
            }
        )
        collaborator.is_active = True
        collaborator.save()
        return {
            'user_identifier': collaborator.user_identifier,
            'user_name': collaborator.user_name,
            'color': collaborator.color
        }

    @database_sync_to_async
    def remove_collaborator(self):
        session_id = self.scope.get('session', {}).get('session_key', 'anonymous')
        user_id = f"user_{session_id}_{self.channel_name[-8:]}"
        
        try:
            collaborator = Collaborator.objects.get(
                note_id=self.note_id,
                user_identifier=user_id
            )
            collaborator.delete()
        except Collaborator.DoesNotExist:
            pass

    @database_sync_to_async
    def get_collaborators(self):
        collaborators = Collaborator.objects.filter(
            note_id=self.note_id,
            is_active=True
        )
        return [
            {
                'user_identifier': collab.user_identifier,
                'user_name': collab.user_name,
                'color': collab.color
            } for collab in collaborators
        ]