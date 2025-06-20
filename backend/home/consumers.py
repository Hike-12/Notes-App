import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from .models import Note, Collaborator, NoteShare
from urllib.parse import parse_qs
import random
import base64


class YjsWebsocketConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Get note_id from URL
        self.note_id = self.scope['url_route']['kwargs']['note_id']
        self.room_group_name = f'yjs_note_{self.note_id}'
        
        # Initialize attributes early to prevent AttributeError in disconnect
        self.user = None
        self.user_identifier = None
        
        # Parse the URL path to extract user_id
        path = self.scope['path']
        query_string = self.scope.get('query_string', b'').decode()
        
        print(f"🔍 Full WebSocket path: {path}")
        print(f"🔍 Query string: {query_string}")
        
        # Extract user_id from query string
        if query_string:
            from urllib.parse import parse_qs
            query_params = parse_qs(query_string)
            user_id = query_params.get('user_id', [None])[0]
        else:
            # Fallback: try to extract from path if no query string
            # This handles cases where y-websocket might format the URL differently
            path_parts = path.strip('/').split('/')
            user_id = None
            for i, part in enumerate(path_parts):
                if part == 'yjs' and i + 1 < len(path_parts):
                    # Check if the next part after 'yjs' contains user info
                    note_part = path_parts[i + 1]
                    if '?user_id=' in note_part:
                        user_id = note_part.split('?user_id=')[1].split('&')[0]
                        self.note_id = note_part.split('?')[0]
                    break
        
        print(f"🔍 Extracted user_id: {user_id}")
        print(f"🔍 Note ID: {self.note_id}")
        
        if not user_id:
            print("❌ No user_id found in WebSocket connection")
            await self.close(code=4001)
            return
        
        # Clean the user_id (remove any trailing slashes or extra characters)
        user_id = str(user_id).strip('/')
        
        # Convert to integer
        try:
            user_id = int(user_id)
        except (ValueError, TypeError):
            print(f"❌ Invalid user_id format: {user_id}")
            await self.close(code=4001)
            return
        
        try:
            # Get user and check permissions
            user = await self.get_user(user_id)
            if not user:
                print(f"❌ User {user_id} not found")
                await self.close(code=4001)
                return
            
            self.user = user
            self.user_identifier = f"user_{user.id}"
            
            print(f"✅ User authenticated: {user.username} (ID: {user.id})")
            
            # Check note access permissions
            note_data = await self.get_note_with_details(self.note_id)
            if not note_data:
                print(f"❌ Note {self.note_id} not found")
                await self.close(code=4004)
                return
            
            is_owner = note_data['owner_id'] == user.id
            has_shared_access = await self.check_shared_access(self.note_id, user.id)
            
            if not (is_owner or has_shared_access):
                print(f"❌ ACCESS DENIED: User {user.username} cannot access note {self.note_id}")
                await self.close(code=4003)
                return
            
            print(f"✅ ACCESS GRANTED: User {user.username} can access note {self.note_id}")
            
            # Join room group
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            
            # Accept the connection
            await self.accept()
            print(f"🚀 Yjs WebSocket CONNECTED: User {user.username} to note {self.note_id}")
            
            # Add collaborator
            await self.add_collaborator()
            
        except Exception as e:
            print(f"❌ Error in Yjs WebSocket connect: {e}")
            import traceback
            traceback.print_exc()
            await self.close(code=4004)
            return

    async def disconnect(self, close_code):
        print(f"🔌 Yjs WebSocket DISCONNECTING: User {getattr(self, 'user', 'Unknown')} from note {getattr(self, 'note_id', 'Unknown')}")
        
        # Only try to remove collaborator if we have the necessary attributes
        if hasattr(self, 'user_identifier') and self.user_identifier and hasattr(self, 'note_id'):
            try:
                await self.remove_collaborator()
            except Exception as e:
                print(f"⚠️ Error removing collaborator: {e}")
        
        # Leave room group if we have the necessary attributes
        if hasattr(self, 'room_group_name') and hasattr(self, 'channel_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    # Rest of your methods remain the same...
    async def receive(self, text_data=None, bytes_data=None):
        """
        Handle incoming Yjs messages - they can be either text or binary
        """
        try:
            if bytes_data:
                # Binary message (Yjs update or sync)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'yjs_update',
                        'data': base64.b64encode(bytes_data).decode('utf-8'),
                        'sender_channel': self.channel_name
                    }
                )
            elif text_data:
                # Text data (likely awareness updates)
                data = json.loads(text_data)
                
                # Handle awareness updates (cursor positions)
                if data.get('type') == 'awareness':
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'awareness_update',
                            'data': data,
                            'sender_channel': self.channel_name
                        }
                    )
        except Exception as e:
            print(f"⚠️ Error in Yjs receive: {e}")
            import traceback
            traceback.print_exc()

    async def yjs_update(self, event):
        """Forward Yjs update to clients"""
        if event['sender_channel'] != self.channel_name:
            # Decode the base64 data back to binary
            binary_data = base64.b64decode(event['data'])
            await self.send(bytes_data=binary_data)

    async def awareness_update(self, event):
        """Forward awareness updates to clients"""
        if event['sender_channel'] != self.channel_name:
            await self.send(text_data=json.dumps(event['data']))

    # Keep all your existing database methods unchanged...
    @database_sync_to_async
    def get_user(self, user_id):
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None

    @database_sync_to_async
    def get_note_with_details(self, note_id):
        try:
            note = Note.objects.select_related('owner').get(id=note_id)
            return {
                'id': note.id,
                'title': note.title,
                'owner_id': note.owner.id,
                'owner_username': note.owner.username,
            }
        except Note.DoesNotExist:
            return None

    @database_sync_to_async
    def check_shared_access(self, note_id, user_id):
        try:
            note = Note.objects.get(id=note_id)
            
            if note.shared_with.filter(id=user_id).exists():
                return True
            
            if NoteShare.objects.filter(note_id=note_id, shared_with_id=user_id).exists():
                return True
                
            return False
        except Note.DoesNotExist:
            return False

    @database_sync_to_async
    def add_collaborator(self):
        colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
        color = random.choice(colors)
        
        collaborator, created = Collaborator.objects.get_or_create(
            note_id=self.note_id,
            user_identifier=self.user_identifier,
            defaults={
                'is_active': True,
                'user_name': self.user.username,
                'color': color,
                'user': self.user
            }
        )
        
        collaborator.is_active = True
        collaborator.user_name = self.user.username
        collaborator.user = self.user
        collaborator.save()
        
        return collaborator

    @database_sync_to_async
    def remove_collaborator(self):
        try:
            collaborator = Collaborator.objects.get(
                note_id=self.note_id,
                user_identifier=self.user_identifier
            )
            collaborator.delete()
            print(f"👤 Collaborator removed: {self.user.username}")
        except Collaborator.DoesNotExist:
            print(f"👤 Collaborator not found to remove")
            
            
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
            self.user_identifier = f"user_{user.id}"
            print(f"✅ WebSocket User found: {user.username} (ID: {user.id})")
            
            # Get note and check permissions
            note_data = await self.get_note_with_details(self.note_id)
            if not note_data:
                print(f"❌ Note {self.note_id} not found")
                await self.close(code=4004)
                return
            
            print(f"✅ Note found: '{note_data['title']}' (ID: {note_data['id']})")
            print(f"📝 Note owner: {note_data['owner_username']} (ID: {note_data['owner_id']})")
            
            # Check permissions
            is_owner = note_data['owner_id'] == user.id
            has_shared_access = await self.check_shared_access(self.note_id, user.id)
            has_access = is_owner or has_shared_access
            
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
            
            # Notify all users about updated collaborators list
            await self.broadcast_collaborators_update()
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
        try:
            note = Note.objects.select_related('owner').get(id=note_id)
            return {
                'id': note.id,
                'title': note.title,
                'owner_id': note.owner.id,
                'owner_username': note.owner.username,
            }
        except Note.DoesNotExist:
            return None

    @database_sync_to_async
    def check_shared_access(self, note_id, user_id):
        try:
            note = Note.objects.get(id=note_id)
            
            if note.shared_with.filter(id=user_id).exists():
                return True
            
            if NoteShare.objects.filter(note_id=note_id, shared_with_id=user_id).exists():
                return True
                
            return False
        except Note.DoesNotExist:
            return False

    async def disconnect(self, close_code):
        print(f"🔌 WebSocket DISCONNECTING: User {getattr(self, 'user', 'Unknown')} from note {self.note_id} (code: {close_code})")
        
        try:
            await self.remove_collaborator()
            # Notify remaining users about collaborator leaving
            await self.broadcast_collaborators_update()
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
                    'user_id': self.user_identifier,
                    'user_name': self.user.username,
                    'sender_channel': self.channel_name
                }
            )

    async def content_update(self, event):
        if event['sender_channel'] != self.channel_name:
            await self.send(text_data=json.dumps({
                'type': 'content_change',
                'content': event['content'],
                'user_id': event['user_id'],
                'user_name': event['user_name']
            }))

    async def collaborators_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'collaborators_update',
            'collaborators': event['collaborators']
        }))

    async def broadcast_collaborators_update(self):
        """Broadcast updated collaborators list to all users in the room"""
        collaborators = await self.get_collaborators()
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'collaborators_update',
                'collaborators': collaborators
            }
        )

    @database_sync_to_async
    def add_collaborator(self):
        colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
        color = random.choice(colors)
        
        collaborator, created = Collaborator.objects.get_or_create(
            note_id=self.note_id,
            user_identifier=self.user_identifier,
            defaults={
                'is_active': True,
                'user_name': self.user.username,
                'color': color,
                'user': self.user
            }
        )
        
        collaborator.is_active = True
        collaborator.user_name = self.user.username
        collaborator.user = self.user
        collaborator.save()
        
        return {
            'user_identifier': collaborator.user_identifier,
            'user_name': collaborator.user_name,
            'color': collaborator.color
        }

    @database_sync_to_async
    def remove_collaborator(self):
        try:
            collaborator = Collaborator.objects.get(
                note_id=self.note_id,
                user_identifier=self.user_identifier
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