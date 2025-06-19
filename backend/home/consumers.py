import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from .models import Note, Collaborator
from urllib.parse import parse_qs
import random

class NoteConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.note_id = self.scope['url_route']['kwargs']['note_id']
        self.room_group_name = f'note_{self.note_id}'
        
        # Get user ID from query parameters
        query_string = self.scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        user_id = query_params.get('user_id', [None])[0]
        
        if not user_id:
            print("❌ No user_id provided in WebSocket connection")
            await self.close(code=4001)
            return
        
        try:
            # Get user from database
            user = await self.get_user(user_id)
            if not user:
                print(f"❌ User {user_id} not found")
                await self.close(code=4001)
                return
            
            self.user = user
            print(f"✅ WebSocket User found: {user.username} (ID: {user.id})")
            
            # Get note with all related data using proper async methods
            note_data = await self.get_note_with_details(self.note_id)
            if not note_data:
                print(f"❌ Note {self.note_id} not found")
                await self.close(code=4004)
                return
            
            print(f"✅ Note found: '{note_data['title']}' (ID: {note_data['id']})")
            print(f"📝 Note owner: {note_data['owner_username']} (ID: {note_data['owner_id']})")
            
            # Check permissions
            is_owner = note_data['owner_id'] == user.id
            shared_user_ids = note_data['shared_user_ids']
            is_shared = user.id in shared_user_ids
            
            print(f"👑 Is owner: {is_owner}")
            print(f"👥 Shared with user IDs: {shared_user_ids}")
            print(f"🔗 User '{user.username}' in shared list: {is_shared}")
            
            has_access = is_owner or is_shared
            print(f"🔒 Final access decision: {has_access}")
            
            if not has_access:
                print(f"❌ ACCESS DENIED: User {user.username} cannot access note {self.note_id}")
                await self.close(code=4003)
                return
            else:
                print(f"✅ ACCESS GRANTED: User {user.username} can access note {self.note_id}")
                
        except Exception as e:
            print(f"❌ Error in WebSocket connect: {e}")
            import traceback
            traceback.print_exc()
            await self.close(code=4004)
            return

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        print(f"🚀 WebSocket CONNECTED: User {user.username} to note {self.note_id}")
        
        # Add collaborator after successful connection
        try:
            await self.add_collaborator()
            print(f"👤 Collaborator added: {user.username}")
        except Exception as e:
            print(f"⚠️ Error adding collaborator: {e}")

    @database_sync_to_async
    def get_user(self, user_id):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None

    @database_sync_to_async
    def get_note_with_details(self, note_id):
        """Get note with all related data in one async call"""
        try:
            note = Note.objects.select_related('owner').prefetch_related('shared_with').get(id=note_id)
            return {
                'id': note.id,
                'title': note.title,
                'owner_id': note.owner.id,
                'owner_username': note.owner.username,
                'shared_user_ids': list(note.shared_with.values_list('id', flat=True))
            }
        except Note.DoesNotExist:
            return None

    async def disconnect(self, close_code):
        print(f"🔌 WebSocket DISCONNECTING: User {getattr(self, 'user', 'Unknown')} from note {self.note_id} (code: {close_code})")
        
        try:
            await self.remove_collaborator()
        except Exception as e:
            print(f"⚠️ Error removing collaborator: {e}")
        
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data['type']
        
        if message_type == 'content_change':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'content_update',
                    'content': data['content'],
                    'user_id': data.get('user_id'),
                    'sender_channel': self.channel_name
                }
            )
        elif message_type == 'cursor_position':
            await self.channel_layer.group_send(
                self.room_group_name,
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
        if event['sender_channel'] != self.channel_name:
            await self.send(text_data=json.dumps({
                'type': 'content_change',
                'content': event['content'],
                'user_id': event['user_id']
            }))

    async def cursor_update(self, event):
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
        user_id = f"user_{self.user.id}"
        
        colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
        color = random.choice(colors)
        
        collaborator, created = Collaborator.objects.get_or_create(
            note_id=self.note_id,
            user_identifier=user_id,
            defaults={
                'is_active': True,
                'user_name': self.user.username,
                'color': color
            }
        )
        collaborator.is_active = True
        collaborator.user_name = self.user.username
        collaborator.save()
        
        return {
            'user_identifier': collaborator.user_identifier,
            'user_name': collaborator.user_name,
            'color': collaborator.color
        }

    @database_sync_to_async
    def remove_collaborator(self):
        user_id = f"user_{self.user.id}"
        
        try:
            collaborator = Collaborator.objects.get(
                note_id=self.note_id,
                user_identifier=user_id
            )
            collaborator.delete()
            print(f"👤 Collaborator removed: {self.user.username}")
        except Collaborator.DoesNotExist:
            print(f"👤 Collaborator not found to remove: {self.user.username}")

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