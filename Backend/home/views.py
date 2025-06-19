from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from .models import Note, Collaborator,NoteShare
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
import json


# Create your views here.
def sidebar(request):
    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)
    
    # Get user's own notes
    owned_notes = Note.objects.filter(owner=request.user).order_by('-last_modified')
    
    # Get shared notes
    shared_note_ids = NoteShare.objects.filter(shared_with=request.user).values_list('note_id', flat=True)
    shared_notes = Note.objects.filter(id__in=shared_note_ids).order_by('-last_modified')
    
    notes_list = []
    
    # Add owned notes
    for note in owned_notes:
        collaborator_count = note.collaborators.filter(is_active=True).count()
        shared_count = note.shares.count()
        notes_list.append({
            'id': note.id,
            'title': note.title,
            'body': note.body[:100] + '...' if len(note.body) > 100 else note.body,
            'collaborators': collaborator_count,
            'shared_count': shared_count,
            'last_modified': note.last_modified.isoformat(),
            'is_owner': True,
            'permission': 'edit'
        })
    
    # Add shared notes
    for note in shared_notes:
        collaborator_count = note.collaborators.filter(is_active=True).count()
        share = NoteShare.objects.get(note=note, shared_with=request.user)
        notes_list.append({
            'id': note.id,
            'title': note.title,
            'body': note.body[:100] + '...' if len(note.body) > 100 else note.body,
            'collaborators': collaborator_count,
            'shared_count': 0,  # Don't show share count for shared notes
            'last_modified': note.last_modified.isoformat(),
            'is_owner': False,
            'permission': share.permission,
            'shared_by': note.owner.username
        })
    
    # Sort by last modified
    notes_list.sort(key=lambda x: x['last_modified'], reverse=True)
    
    return JsonResponse(notes_list, safe=False)

@csrf_exempt
@require_http_methods(["GET"])
def get_note(request, id):
    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)
    
    try:
        note = get_object_or_404(Note, id=id)
        
        # Check permissions
        is_owner = note.owner == request.user
        has_access = False
        permission = None
        
        if is_owner:
            has_access = True
            permission = 'edit'
        else:
            try:
                share = NoteShare.objects.get(note=note, shared_with=request.user)
                has_access = True
                permission = share.permission
            except NoteShare.DoesNotExist:
                pass
        
        if not has_access:
            return JsonResponse({'success': False, 'message': 'Access denied'}, status=403)
        
        collaborators = note.collaborators.filter(is_active=True)
        shares = note.shares.all() if is_owner else []
        
        note_data = {
            'id': note.id,
            'title': note.title,
            'body': note.body,
            'is_owner': is_owner,
            'permission': permission,
            'owner': {
                'id': note.owner.id,
                'username': note.owner.username,
                'first_name': note.owner.first_name,
                'last_name': note.owner.last_name
            },
            'collaborators': [
                {
                    'user_identifier': collab.user_identifier,
                    'user_name': collab.user_name,
                    'color': collab.color
                } for collab in collaborators
            ],
            'shares': [
                {
                    'id': share.id,
                    'user': {
                        'id': share.shared_with.id,
                        'username': share.shared_with.username,
                        'first_name': share.shared_with.first_name,
                        'last_name': share.shared_with.last_name
                    },
                    'permission': share.permission,
                    'shared_at': share.shared_at.isoformat()
                } for share in shares
            ]
        }
        return JsonResponse(note_data, status=200)
    except Note.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Note not found'}, status=404)

@csrf_exempt
@require_http_methods(["POST"])
def save_note(request):
    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)
    
    try:
        data = json.loads(request.body)
        note_content = data.get('content', '')
        note_title = data.get('title', 'Untitled Note')
        note_id = data.get('id', None)
        
        channel_layer = get_channel_layer()
        
        if note_id:
            note = get_object_or_404(Note, id=note_id)
            
            # Check permissions
            is_owner = note.owner == request.user
            has_edit_access = False
            
            if is_owner:
                has_edit_access = True
            else:
                try:
                    share = NoteShare.objects.get(note=note, shared_with=request.user)
                    has_edit_access = share.permission == 'edit'
                except NoteShare.DoesNotExist:
                    pass
            
            if not has_edit_access:
                return JsonResponse({'success': False, 'message': 'Edit access denied'}, status=403)
            
            note.body = note_content
            note.title = note_title
            note.save()
            
            # Broadcast save notification to all collaborators
            async_to_sync(channel_layer.group_send)(
                f'note_{note_id}',
                {
                    'type': 'note_saved',
                    'message': f'Note saved by {request.user.username}'
                }
            )
            
            return JsonResponse({
                'success': True,
                'id': note.id,
                'title': note.title
            }, status=200)
        else:
            # Create new note
            note = Note.objects.create(
                body=note_content,
                title=note_title,
                owner=request.user
            )
            return JsonResponse({
                'success': True,
                'id': note.id,
                'title': note.title
            }, status=201)
    
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)
    except Note.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Note not found'}, status=404)

@csrf_exempt
@require_http_methods(["DELETE"])
def delete_note(request, id):
    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)
    
    try:
        note = get_object_or_404(Note, id=id)
        
        # Only owner can delete
        if note.owner != request.user:
            return JsonResponse({'success': False, 'message': 'Only owner can delete notes'}, status=403)
        
        # Notify all collaborators before deletion
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'note_{id}',
            {
                'type': 'note_deleted',
                'message': f'Note deleted by {request.user.username}'
            }
        )
        
        note.delete()
        return JsonResponse({'success': True}, status=200)
    except Note.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Note not found'}, status=404)

@csrf_exempt
@require_http_methods(["POST"])
def share_note(request, note_id):
    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)
    
    try:
        data = json.loads(request.body)
        username = data.get('username')
        permission = data.get('permission', 'view')
        
        note = get_object_or_404(Note, id=note_id)
        
        # Check if user is owner
        if note.owner != request.user:
            return JsonResponse({'success': False, 'message': 'Only owner can share notes'}, status=403)
        
        # Get user to share with
        try:
            shared_with = User.objects.get(username=username)
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'User not found'}, status=404)
        
        # Don't allow sharing with self
        if shared_with == request.user:
            return JsonResponse({'success': False, 'message': 'Cannot share with yourself'}, status=400)
        
        # Create or update share
        share, created = NoteShare.objects.update_or_create(
            note=note,
            shared_with=shared_with,
            defaults={
                'permission': permission,
                'shared_by': request.user
            }
        )
        
        message = 'Note shared successfully' if created else 'Share permission updated'
        
        return JsonResponse({
            'success': True,
            'message': message,
            'share': {
                'id': share.id,
                'user': {
                    'id': shared_with.id,
                    'username': shared_with.username,
                    'first_name': shared_with.first_name,
                    'last_name': shared_with.last_name
                },
                'permission': share.permission,
                'shared_at': share.shared_at.isoformat()
            }
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

@csrf_exempt
@require_http_methods(["DELETE"])
def revoke_share(request, note_id, share_id):
    if not request.user.is_authenticated:
        return JsonResponse({'authenticated': False}, status=401)
    
    try:
        note = get_object_or_404(Note, id=note_id)
        share = get_object_or_404(NoteShare, id=share_id, note=note)
        
        # Check if user is owner
        if note.owner != request.user:
            return JsonResponse({'success': False, 'message': 'Only owner can revoke shares'}, status=403)
        
        share.delete()
        return JsonResponse({'success': True, 'message': 'Share revoked successfully'})
        
    except (Note.DoesNotExist, NoteShare.DoesNotExist):
        return JsonResponse({'success': False, 'message': 'Share not found'}, status=404)
    
    
    ###### Authentication and Authorization Views ######
@csrf_exempt
@require_http_methods(["POST"])
def register_user(request):
    try:
        data = json.loads(request.body)
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        first_name = data.get('first_name', '')
        last_name = data.get('last_name', '')
        
        # Check if user already exists
        if User.objects.filter(username=username).exists():
            return JsonResponse({'success': False, 'message': 'Username already exists'}, status=400)
        
        if User.objects.filter(email=email).exists():
            return JsonResponse({'success': False, 'message': 'Email already exists'}, status=400)
        
        # Create user
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )
        
        # Auto login after registration
        login(request, user)
        
        return JsonResponse({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name
            }
        })
        
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def login_user(request):
    try:
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            login(request, user)
            return JsonResponse({
                'success': True,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name
                }
            })
        else:
            return JsonResponse({'success': False, 'message': 'Invalid credentials'}, status=401)
            
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'message': 'Invalid JSON'}, status=400)

@csrf_exempt
@require_http_methods(["POST"])
def logout_user(request):
    logout(request)
    return JsonResponse({'success': True, 'message': 'Logged out successfully'})

@require_http_methods(["GET"])
def get_current_user(request):
    if request.user.is_authenticated:
        return JsonResponse({
            'authenticated': True,
            'user': {
                'id': request.user.id,
                'username': request.user.username,
                'email': request.user.email,
                'first_name': request.user.first_name,
                'last_name': request.user.last_name
            }
        })
    else:
        return JsonResponse({'authenticated': False})

@csrf_exempt
@require_http_methods(["GET"])
def search_users(request):
    if not request.user.is_authenticated:
        return JsonResponse({'success': False, 'message': 'Authentication required'}, status=401)
    
    query = request.GET.get('q', '')
    if len(query) < 2:
        return JsonResponse({'users': []})
    
    users = User.objects.filter(
        username__icontains=query
    ).exclude(id=request.user.id)[:10]
    
    users_data = [
        {
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name
        } for user in users
    ]
    
    return JsonResponse({'users': users_data})